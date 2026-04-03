import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import crypto from 'node:crypto';
import { getUserId } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import {
  getTask,
  updateTaskAfterRaise,
  putTaskUpdate,
} from '../services/dynamo.js';
import { assessUpdate } from '../services/ai-assessor.js';
import { SubmitUpdateRequestSchema } from '../schemas/update.js';
import {
  calculateCurrentDepth,
  calculateRaisePercent,
  TIER_SINK_RATE_PER_MS,
} from '@sink-board/shared';
import type { SubmitUpdateRequest, SubmitUpdateResponse, TaskUpdate } from '@sink-board/shared';

export const handler = validateBody(
  SubmitUpdateRequestSchema,
  async (
    event: APIGatewayProxyEventV2,
    body: SubmitUpdateRequest,
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

      // AI assessment
      const assessment = await assessUpdate(
        task.title,
        task.description,
        body.content,
      );

      const raisePercent = calculateRaisePercent(assessment.score);

      // Calculate current depth including time-based sinking
      const currentDepth = calculateCurrentDepth(
        task.currentDepthPercent,
        task.lastRaisedAt,
        TIER_SINK_RATE_PER_MS[task.sizeTier],
      );

      // Apply raise
      const newDepth = Math.max(0, currentDepth - raisePercent);
      const now = new Date().toISOString();

      // Persist task update
      await updateTaskAfterRaise(userId, taskId, newDepth, now);

      // Write update record
      const updateId = crypto.randomUUID();
      const taskUpdate: TaskUpdate = {
        updateId,
        taskId,
        userId,
        content: body.content,
        aiScore: assessment.score,
        raisePercent,
        createdAt: now,
      };
      await putTaskUpdate(taskUpdate);

      const response: SubmitUpdateResponse = {
        update: taskUpdate,
        newDepthPercent: newDepth,
        aiScore: assessment.score,
        raisePercent,
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
      console.error('submit-update error', err);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Internal server error' }),
      };
    }
  },
);
