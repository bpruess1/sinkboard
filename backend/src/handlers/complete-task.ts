import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { verifyTaskOwnership } from '../middleware/authorization.js';
import { updateTaskStatus } from '../services/dynamo.js';
import type { Task } from '@sink-board/shared';

/**
 * Lambda handler for completing a task.
 * 
 * This endpoint allows users to mark their tasks as complete. It implements:
 * - Authentication: Validates the user is logged in
 * - Authorization: Verifies the task belongs to the authenticated user
 * - State transition: Updates task status to 'complete'
 * 
 * Security considerations:
 * - Task ownership is verified before any mutation occurs
 * - Only the task owner can complete their own tasks
 * - Invalid taskIds or unauthorized access attempts return appropriate error codes
 * 
 * @param event - API Gateway event with path parameter: taskId
 * @returns 200 with updated task on success
 *          403 if user doesn't own the task
 *          404 if task doesn't exist
 *          500 on server errors
 * 
 * Path: POST /tasks/{taskId}/complete
 */
export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  try {
    const taskId = event.pathParameters?.taskId;

    if (!taskId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'taskId is required' }),
      };
    }

    // Verify ownership before allowing mutation
    const task = await verifyTaskOwnership(event, taskId);

    // Update task status to complete
    const updatedTask = await updateTaskStatus(taskId, 'complete');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedTask),
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'UnauthorizedError') {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: error.message }),
      };
    }

    if (error instanceof Error && error.message === 'Task not found') {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Task not found' }),
      };
    }

    console.error('Error completing task:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to complete task' }),
    };
  }
};
