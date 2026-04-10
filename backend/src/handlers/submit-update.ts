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
  calculateRaisePerc,
  depthCheck,
} from '../utils/depth.js';
import { log } from '../utils/logger.js';
import type { SubmitUpdateRequest, TaskUpdate } from '@sink-board/shared';

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
        body: JSON.stringify({ error: 'taskId is required' }),
      };
    }

    const task = await getTask(taskId, userId);
    if (!task) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Task not found' }),
      };
    }

    if (task.userId !== userId) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Not authorized to update this task' }),
      };
    }

    const updateId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    let assessmentScore = DEFAULT_ASSESSMENT_SCORE;
    let assessmentError: string | undefined;

    try {
      const assessment = await assessUpdate({
        taskTitle: task.title,
        taskDescription: task.description || '',
        updateText: body.updateText,
      });
      assessmentScore = assessment.score;
    } catch (error) {
      log('warn', 'Assessment scoring failed, using default score', {
        taskId,
        updateId,
        error: error instanceof Error ? error.message : String(error),
      });
      assessmentError = 'Assessment scoring is unavailable. Assigning default score.';
    }

    const currentDepth = calculateCurrentDepth(task);
    const raisePerc = calculateRaisePerc(assessmentScore);
    const newDepth = Math.max(0, currentDepth - raisePerc);

    const update: TaskUpdate = {
      updateId,
      taskId,
      userId,
      updateText: body.updateText,
      timestamp,
      assessmentScore,
      raisePerc,
      depthBefore: currentDepth,
      depthAfter: newDepth,
    };

    await putTaskUpdate(update);

    const krakenTook = depthCheck(newDepth, task.sizeTier);
    const updatedTask = await updateTaskAfterRaise(
      taskId,
      userId,
      newDepth,
      krakenTook,
      timestamp,
    );

    if (!updatedTask) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to update task' }),
      };
    }

    const responseBody: any = {
      task: updatedTask,
      update,
    };

    if (assessmentError) {
      responseBody.warning = assessmentError;
    }

    return {
      statusCode: 200,
      body: JSON.stringify(responseBody),
    };
  },
);
