import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getUserId } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import { getTask, putUpdate } from '../services/dynamo.js';
import { SubmitUpdateRequestSchema } from '../schemas/update.js';
import { assessUpdate } from '../services/assessment.js';
import { checkAuthorization } from '../middleware/authorization.js';
import { logger } from '../utils/logger.js';
import type { SubmitUpdateRequest, Update } from '@sink-board/shared';

export const handler = validateBody(
  SubmitUpdateRequestSchema,
  async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    const userId = getUserId(event);
    const { taskId } = event.pathParameters || {};

    if (!taskId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing taskId' }),
      };
    }

    const body = JSON.parse(event.body!) as SubmitUpdateRequest;

    // Get task and verify authorization
    const task = await getTask(taskId);
    if (!task) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Task not found' }),
      };
    }

    const authResult = checkAuthorization(userId, task);
    if (authResult) {
      return authResult;
    }

    // Get previous updates for context
    const previousUpdates = task.updates || [];

    // Assess the update using LLM
    const assessment = await assessUpdate(task, body.text, previousUpdates);

    const update: Update = {
      timestamp: new Date().toISOString(),
      text: body.text,
      score: assessment.score,
      reasoning: assessment.reasoning,
    };

    logger.info('Submitting update with assessment', {
      taskId,
      userId,
      hasText: !!body.text,
      score: assessment.score,
      meaningfulProgress: assessment.meaningfulProgress,
    });

    await putUpdate(taskId, update);

    return {
      statusCode: 200,
      body: JSON.stringify({
        update,
        assessment: {
          score: assessment.score,
          meaningfulProgress: assessment.meaningfulProgress,
          reasoning: assessment.reasoning,
        },
      }),
    };
  }
);
