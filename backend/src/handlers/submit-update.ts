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
  TIER_VALUES,
} from '@sink-board/shared';
import type { SubmitUpdateRequest, TaskUpdate, TaskStatus } from '@sink-board/shared';
import { logger } from '../utils/logger.js';

const DEFAULT_ASSESSMENT_SCORE = 29;

export const handler = validateBody(
  SubmitUpdateRequestSchema,
  async (
    event: APIGatewayProxyEventV2,
    body: SubmitUpdateRequest,
  ): Promise<APIGatewayProxyResultV2> => {
    const userId = getUserId(event);
    const taskId = event.pathParameters?.taskId;

    if (!taskId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Task ID is required' }),
      };
    }

    const task = await getTask(taskId);

    if (!task) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Task not found' }),
      };
    }

    if (task.userId !== userId) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Forbidden' }),
      };
    }

    if (task.status === 'completed') {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Task is already completed' }),
      };
    }

    const updateId = crypto.randomUUID();
    const now = new Date().toISOString();

    let assessmentScore: number;
    let assessmentFeedback: string | undefined;
    let newStatus: TaskStatus;
    let errorMessage: string | undefined;

    try {
      const assessment = await assessUpdate({
        taskTitle: task.title,
        taskDescription: task.description || '',
        updateContent: body.content,
        sizeTier: task.sizeTier,
      });

      assessmentScore = assessment.score;
      assessmentFeedback = assessment.feedback;
      newStatus = 'ready for review';
    } catch (error) {
      logger.error('Assessment scoring unavailable', {
        taskId,
        updateId,
        error: error instanceof Error ? error.message : String(error),
      });

      assessmentScore = DEFAULT_ASSESSMENT_SCORE;
      assessmentFeedback = undefined;
      newStatus = 'processing';
      errorMessage = 'Assessment scoring is unavailable. Assigning default score.';
    }

    const taskUpdate: TaskUpdate = {
      updateId,
      taskId,
      userId,
      content: body.content,
      hoursSpent: body.hoursSpent,
      submittedAt: now,
      assessmentScore,
      assessmentFeedback,
    };

    await putTaskUpdate(taskUpdate);

    const tierValue = TIER_VALUES[task.sizeTier];
    const currentDepth = calculateCurrentDepth(
      task.totalHoursSpent,
      tierValue,
      task.raiseHistory,
    );

    const newTotalHours = task.totalHoursSpent + body.hoursSpent;
    const newDepth = calculateCurrentDepth(
      newTotalHours,
      tierValue,
      task.raiseHistory,
    );

    const raisePercentage = calculateRaisePercentage(currentDepth, newDepth);

    if (raisePercentage > 0) {
      await updateTaskAfterRaise({
        taskId,
        userId,
        hoursSpent: body.hoursSpent,
        raisePercentage,
        status: newStatus,
      });
    } else {
      await updateTaskAfterRaise({
        taskId,
        userId,
        hoursSpent: body.hoursSpent,
        raisePercentage: 0,
        status: newStatus,
      });
    }

    const responseBody: { update: TaskUpdate; errorMessage?: string } = {
      update: taskUpdate,
    };

    if (errorMessage) {
      responseBody.errorMessage = errorMessage;
    }

    return {
      statusCode: 201,
      body: JSON.stringify(responseBody),
    };
  },
);
