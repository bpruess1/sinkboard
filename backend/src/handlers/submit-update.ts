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
  calculateRaisePercentage,
  calculateNewDepth,
} from '@sink-board/shared';
import { logger } from '../utils/logger.js';
import type { SubmitUpdateRequest, TaskUpdate } from '@sink-board/shared';

export const handler = validateBody(
  SubmitUpdateRequestSchema,
  async (
    event: APIGatewayProxyEventV2,
    body: SubmitUpdateRequest,
  ): Promise<APIGatewayProxyResultV2> => {
    const userId = getUserId(event);
    const { taskId } = event.pathParameters || {};

    if (!taskId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'taskId is required' }),
      };
    }

    try {
      const task = await getTask(taskId);

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
          body: JSON.stringify({ error: 'Not authorized to update this task' }),
        };
      }

      if (task.status === 'complete') {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Cannot update a completed task' }),
        };
      }

      const currentDepth = calculateCurrentDepth(task);

      const updateId = crypto.randomUUID();
      const now = new Date().toISOString();

      const newUpdate: TaskUpdate = {
        updateId,
        taskId,
        userId,
        text: body.text,
        timestamp: now,
        raisePerc: 0,
        assessmentScore: 0,
        assessmentReasoning: 'Pending assessment',
      };

      await putTaskUpdate(newUpdate);

      const assessmentResult = await assessUpdate(task, newUpdate, currentDepth);

      const raisePerc = calculateRaisePercentage(assessmentResult.score);
      const newDepth = calculateNewDepth(currentDepth, raisePerc);

      newUpdate.raisePerc = raisePerc;
      newUpdate.assessmentScore = assessmentResult.score;
      newUpdate.assessmentReasoning = assessmentResult.reasoning;

      await putTaskUpdate(newUpdate);

      await updateTaskAfterRaise(taskId, raisePerc, now);

      logger.info('Update submitted successfully', {
        taskId,
        updateId,
        userId,
        assessmentScore: assessmentResult.score,
        raisePerc,
        newDepth,
        usedDefault: assessmentResult.usedDefault,
      });

      const responseBody: Record<string, unknown> = {
        updateId,
        raisePerc,
        newDepth,
        assessmentScore: assessmentResult.score,
        assessmentReasoning: assessmentResult.reasoning,
      };

      if (assessmentResult.usedDefault) {
        responseBody.warning = 'Assessment scoring is unavailable. Assigning default score.';
      }

      return {
        statusCode: 201,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(responseBody),
      };
    } catch (error) {
      logger.error('Failed to submit update', {
        taskId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Failed to submit update' }),
      };
    }
  },
);
