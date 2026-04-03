import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getUserId } from '../middleware/auth.js';
import {
  getTask,
  updateTaskAfterKraken,
  updateUserScore,
} from '../services/dynamo.js';
import {
  calculateCurrentDepth,
  TIER_SINK_RATE_PER_MS,
  KRAKEN_DEPTH_THRESHOLD,
} from '@sink-board/shared';
import type { KrakenTookResponse } from '@sink-board/shared';

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  try {
    const userId = getUserId(event);
    const taskId = event.pathParameters?.id;

    if (!taskId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing task id in path' }),
      };
    }

    const task = await getTask(userId, taskId);

    if (!task) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Task not found' }),
      };
    }

    if (task.userId !== userId) {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Forbidden' }),
      };
    }

    if (task.status !== 'active') {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Task is not active' }),
      };
    }

    // Calculate actual current depth
    const currentDepth = calculateCurrentDepth(
      task.currentDepthPercent,
      task.lastRaisedAt,
      TIER_SINK_RATE_PER_MS[task.sizeTier],
    );

    if (currentDepth < KRAKEN_DEPTH_THRESHOLD) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Task has not sunk to kraken depth' }),
      };
    }

    // Deduct points from user
    const newScore = await updateUserScore(userId, -task.value);

    // Reset task
    const newKrakenCount = task.krakenCount + 1;
    await updateTaskAfterKraken(userId, taskId, newKrakenCount);

    const updatedTask = {
      ...task,
      currentDepthPercent: 0,
      lastRaisedAt: new Date().toISOString(),
      krakenCount: newKrakenCount,
    };

    const response: KrakenTookResponse = {
      task: updatedTask,
      pointsLost: task.value,
      newScore,
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response),
    };
  } catch (err: any) {
    if (err.statusCode === 401) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: err.message }),
      };
    }
    console.error('kraken-took error', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
