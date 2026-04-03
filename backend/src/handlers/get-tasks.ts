import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getUserId } from '../middleware/auth.js';
import { getTasksForUser } from '../services/dynamo.js';
import { calculateJewelLevel } from '../services/scoring.js';
import { calculateCurrentDepth, TIER_SINK_RATE_PER_MS } from '@sink-board/shared';
import type { Task } from '@sink-board/shared';

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  try {
    const userId = getUserId(event);
    const tasks = await getTasksForUser(userId);

    const enriched = tasks.map((task: Task) => ({
      ...task,
      jewelLevel: calculateJewelLevel(task.createdAt, task.krakenCount),
      currentDepthPercent:
        task.status === 'active'
          ? calculateCurrentDepth(
              task.currentDepthPercent,
              task.lastRaisedAt,
              TIER_SINK_RATE_PER_MS[task.sizeTier],
            )
          : task.currentDepthPercent,
    }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(enriched),
    };
  } catch (err: any) {
    if (err.statusCode === 401) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: err.message }),
      };
    }
    console.error('get-tasks error', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
