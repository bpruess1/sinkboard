import type { SQSEvent, SQSRecord } from 'aws-lambda';
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { logger } from '../utils/logger.js';
import type { AssessmentRequest, AssessmentResult } from '../services/ai-assessor.js';

const dynamodb = new DynamoDBClient({});
const bedrock = new BedrockRuntimeClient({ region: 'us-east-1' });
const TABLE_NAME = process.env.TABLE_NAME!;
const MAX_RETRIES = 3;
const ASSESSMENT_TIMEOUT_MS = 25000;

export const handler = async (event: SQSEvent): Promise<void> => {
  const results = await Promise.allSettled(
    event.Records.map((record) => processRecord(record)),
  );

  const failures = results.filter((r) => r.status === 'rejected');
  if (failures.length > 0) {
    logger.error('Some assessments failed', { failureCount: failures.length });
    throw new Error(`${failures.length} assessment(s) failed`);
  }
};

async function processRecord(record: SQSRecord): Promise<void> {
  const request: AssessmentRequest = JSON.parse(record.body);
  const { taskId, updateId, userId } = request;

  logger.info('Processing assessment', { taskId, updateId });

  try {
    const result = await assessWithTimeout(request, ASSESSMENT_TIMEOUT_MS);
    await updateTaskWithAssessment(taskId, updateId, userId, result);

    logger.info('Assessment completed', {
      taskId,
      updateId,
      approved: result.approved,
      confidence: result.confidence,
    });
  } catch (error) {
    logger.error('Assessment processing failed', {
      taskId,
      updateId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

async function assessWithTimeout(
  request: AssessmentRequest,
  timeoutMs: number,
): Promise<AssessmentResult> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Assessment timeout')), timeoutMs),
  );

  return Promise.race([performAssessment(request), timeoutPromise]);
}

async function performAssessment(request: AssessmentRequest): Promise<AssessmentResult> {
  const prompt = `You are assessing a progress update for a task. Determine if the update represents genuine progress.

Task: ${request.taskTitle}
${request.taskDescription ? `Description: ${request.taskDescription}` : ''}
Current Depth: ${request.currentDepth}%

Update: ${request.updateContent}

Respond with JSON: {"approved": boolean, "notes": string, "confidence": number}`;

  const command = new InvokeModelCommand({
    modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const response = await bedrock.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  const assessmentText = responseBody.content[0].text;

  const jsonMatch = assessmentText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Invalid AI response format');
  }

  const assessment = JSON.parse(jsonMatch[0]);

  return {
    approved: Boolean(assessment.approved),
    aiNotes: String(assessment.notes || ''),
    confidence: Number(assessment.confidence || 0.5),
  };
}

async function updateTaskWithAssessment(
  taskId: string,
  updateId: string,
  userId: string,
  result: AssessmentResult,
): Promise<void> {
  const now = new Date().toISOString();

  const command = new UpdateItemCommand({
    TableName: TABLE_NAME,
    Key: marshall({ PK: `USER#${userId}`, SK: `TASK#${taskId}#UPDATE#${updateId}` }),
    UpdateExpression:
      'SET assessmentStatus = :status, approved = :approved, aiNotes = :notes, assessedAt = :assessedAt',
    ExpressionAttributeValues: marshall({
      ':status': 'completed',
      ':approved': result.approved,
      ':notes': result.aiNotes,
      ':assessedAt': now,
    }),
  });

  await dynamodb.send(command);
}
