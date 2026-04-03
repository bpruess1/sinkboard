import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getUserId } from '../middleware/auth.js';
import { getTask, completeTask, updateUserScore, getUser } from '../services/dynamo.js';
import type { CompleteTaskResponse } from '@sink-board/shared';

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

    await completeTask(userId, taskId);
    const newScore = await updateUserScore(userId, task.value);

    const completedTask = { ...task, status: 'completed' as const };

    const response: CompleteTaskResponse = {
      task: completedTask,
      pointsGained: task.value,
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
    console.error('complete-task error', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
