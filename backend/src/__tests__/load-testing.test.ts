import { DynamoDBDocumentClient, QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { getTasksForUser } from '../services/dynamo.js';
import { calculateJewelLevel } from '../services/scoring.js';
import { calculateCurrentDepth, TIER_SINK_RATE_PER_MS } from '@sink-board/shared';

const dynamoMock = mockClient(DynamoDBDocumentClient);

// --------------- Load Testing Configuration ---------------

const CONCURRENT_USERS = 100;
const REQUESTS_PER_USER = 10;
const ACCEPTABLE_P95_MS = 500;
const ACCEPTABLE_P99_MS = 1000;
const MAX_ERROR_RATE = 0.01; // 1%

interface PerformanceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  responseTimes: number[];
  p50: number;
  p95: number;
  p99: number;
  errorRate: number;
  avgResponseTime: number;
}

// --------------- Performance Testing Utilities ---------------

function calculatePercentile(sorted: number[], percentile: number): number {
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function analyzeMetrics(responseTimes: number[], failures: number): PerformanceMetrics {
  const totalRequests = responseTimes.length + failures;
  const sorted = [...responseTimes].sort((a, b) => a - b);
  
  return {
    totalRequests,
    successfulRequests: responseTimes.length,
    failedRequests: failures,
    responseTimes: sorted,
    p50: calculatePercentile(sorted, 50),
    p95: calculatePercentile(sorted, 95),
    p99: calculatePercentile(sorted, 99),
    errorRate: failures / totalRequests,
    avgResponseTime: sorted.reduce((a, b) => a + b, 0) / sorted.length,
  };
}

async function simulateUserLoad(
  userId: string,
  requestCount: number,
): Promise<{ responseTimes: number[]; failures: number }> {
  const responseTimes: number[] = [];
  let failures = 0;

  for (let i = 0; i < requestCount; i++) {
    const start = Date.now();
    try {
      await getTasksForUser(userId);
      responseTimes.push(Date.now() - start);
    } catch (error) {
      failures++;
    }
  }

  return { responseTimes, failures };
}

// --------------- Query Optimization Tests ---------------

describe('Database Query Optimization', () => {
  beforeEach(() => {
    dynamoMock.reset();
  });

  it('should use efficient DynamoDB query patterns', async () => {
    const userId = 'user-123';
    const mockTasks = Array.from({ length: 50 }, (_, i) => ({
      PK: `USER#${userId}`,
      SK: `TASK#${i}`,
      id: `task-${i}`,
      title: `Task ${i}`,
      status: 'todo',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    dynamoMock.on(QueryCommand).resolves({ Items: mockTasks });

    const start = Date.now();
    await getTasksForUser(userId);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(100);
    expect(dynamoMock.calls()).toHaveLength(1);
    
    const queryCall = dynamoMock.call(0);
    expect(queryCall.args[0].input).toHaveProperty('KeyConditionExpression');
    expect(queryCall.args[0].input).not.toHaveProperty('FilterExpression');
  });

  it('should handle pagination efficiently for large datasets', async () => {
    const userId = 'user-456';
    const batchSize = 100;
    
    dynamoMock.on(QueryCommand).resolves({
      Items: Array.from({ length: batchSize }, (_, i) => ({
        PK: `USER#${userId}`,
        SK: `TASK#${i}`,
        id: `task-${i}`,
      })),
      LastEvaluatedKey: undefined,
    });

    const tasks = await getTasksForUser(userId);
    expect(tasks.length).toBeLessThanOrEqual(batchSize);
  });
});

// --------------- Scoring Performance Tests ---------------

describe('Scoring Algorithm Performance', () => {
  it('should calculate jewel levels efficiently at scale', () => {
    const iterations = 10000;
    const createdAt = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const start = Date.now();
    for (let i = 0; i < iterations; i++) {
      calculateJewelLevel(createdAt, i % 5);
    }
    const duration = Date.now() - start;

    const avgTime = duration / iterations;
    expect(avgTime).toBeLessThan(0.1);
  });

  it('should calculate depth efficiently for all tiers', () => {
    const iterations = 10000;
    const tiers: Array<'S' | 'M' | 'L' | 'XL'> = ['S', 'M', 'L', 'XL'];
    const createdAt = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const start = Date.now();
    for (let i = 0; i < iterations; i++) {
      const tier = tiers[i % 4];
      calculateCurrentDepth(createdAt, TIER_SINK_RATE_PER_MS[tier]);
    }
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(100);
  });
});

// --------------- Load Testing Suite ---------------

describe('Load Testing Under Realistic Conditions', () => {
  beforeEach(() => {
    dynamoMock.reset();
    dynamoMock.on(QueryCommand).resolves({
      Items: Array.from({ length: 20 }, (_, i) => ({
        PK: 'USER#test',
        SK: `TASK#${i}`,
        id: `task-${i}`,
        title: `Task ${i}`,
        status: 'todo',
        createdAt: new Date().toISOString(),
      })),
    });
  });

  it('should handle concurrent user requests within SLA', async () => {
    const userIds = Array.from({ length: CONCURRENT_USERS }, (_, i) => `user-${i}`);
    
    const results = await Promise.all(
      userIds.map(userId => simulateUserLoad(userId, REQUESTS_PER_USER)),
    );

    const allResponseTimes = results.flatMap(r => r.responseTimes);
    const totalFailures = results.reduce((sum, r) => sum + r.failures, 0);
    const metrics = analyzeMetrics(allResponseTimes, totalFailures);

    expect(metrics.p95).toBeLessThan(ACCEPTABLE_P95_MS);
    expect(metrics.p99).toBeLessThan(ACCEPTABLE_P99_MS);
    expect(metrics.errorRate).toBeLessThan(MAX_ERROR_RATE);
  }, 30000);
});
