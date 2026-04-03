import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import crypto from 'node:crypto';
import { getUserId } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import { putTask } from '../services/dynamo.js';
import { CreateTaskRequestSchema } from '../schemas/task.js';
import { TIER_VALUES } from '@sink-board/shared';
import type { CreateTaskRequest, Task } from '@sink-board/shared';

export const handler = validateBody(
  CreateTaskRequestSchema,
  async (
    event: APIGatewayProxyEventV2,
    body: CreateTaskRequest,
  ): Promise<APIGatewayProxyResultV2> => {
    try {
      const userId = getUserId(event);
      const now = new Date().toISOString();
      const taskId = crypto.randomUUID();

      const task: Task = {
        taskId,
        userId,
        title: body.title,
        description: body.description ?? '',
        sizeTier: body.sizeTier,
        value: TIER_VALUES[body.sizeTier],
        currentDepthPercent: 0,
        lastRaisedAt: now,
        status: 'active',
        jewelLevel: 0,
        krakenCount: 0,
        createdAt: now,
      };

      await putTask(task);

      return {
        statusCode: 201,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task),
      };
    } catch (err: any) {
      if (err.statusCode === 401) {
        return {
          statusCode: 401,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: err.message }),
        };
      }
      console.error('create-task error', err);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Internal server error' }),
      };
    }
  },
);
