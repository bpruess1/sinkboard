import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { getUserId } from './auth.js';
import { getTask } from '../services/dynamo.js';

/**
 * Authorization error thrown when a user attempts to access a resource they don't own.
 * This error should be caught and translated to a 403 Forbidden response.
 */
export class UnauthorizedError extends Error {
  constructor(message: string = 'You do not have permission to access this resource') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Verifies that the authenticated user owns the specified task.
 * 
 * This function performs ownership validation by:
 * 1. Extracting the authenticated userId from the event context
 * 2. Fetching the task from the database
 * 3. Comparing the task's userId with the authenticated userId
 * 
 * @param event - The API Gateway proxy event containing authentication context
 * @param taskId - The ID of the task to verify ownership for
 * @throws {UnauthorizedError} If the task doesn't belong to the authenticated user
 * @throws {Error} If the task is not found (404 should be handled by caller)
 * @returns The task object if ownership is verified
 * 
 * @example
 * ```typescript
 * const task = await verifyTaskOwnership(event, taskId);
 * // Proceed with mutation
 * ```
 */
export async function verifyTaskOwnership(
  event: APIGatewayProxyEventV2,
  taskId: string,
) {
  const userId = getUserId(event);
  const task = await getTask(taskId);

  if (!task) {
    throw new Error('Task not found');
  }

  if (task.userId !== userId) {
    throw new UnauthorizedError('You do not have permission to modify this task');
  }

  return task;
}

/**
 * Higher-order function that wraps a Lambda handler with authentication and ownership verification.
 * 
 * This middleware combines:
 * - Authentication: Validates the user is authenticated (via getUserId)
 * - Authorization: Validates the user owns the resource they're trying to access
 * 
 * The wrapped handler receives the verified task as an additional parameter, eliminating
 * the need for redundant database queries and ownership checks.
 * 
 * @param handler - The Lambda handler function that requires task ownership verification.
 *                  Receives (event, verifiedTask) as parameters.
 * @param getTaskIdFromEvent - Function to extract taskId from the event (e.g., from path or body)
 * @returns A wrapped handler that performs auth + ownership checks before invoking the original handler
 * 
 * @example
 * ```typescript
 * export const handler = withTaskOwnership(
 *   async (event, task) => {
 *     // task is already verified to belong to the authenticated user
 *     await mutateTask(task.taskId);
 *     return { statusCode: 200, body: JSON.stringify(task) };
 *   },
 *   (event) => event.pathParameters?.taskId!,
 * );
 * ```
 */
export function withTaskOwnership<T extends APIGatewayProxyEventV2>(
  handler: (event: T, task: any) => Promise<any>,
  getTaskIdFromEvent: (event: T) => string,
) {
  return async (event: T) => {
    try {
      const taskId = getTaskIdFromEvent(event);
      const task = await verifyTaskOwnership(event, taskId);
      return await handler(event, task);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
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

      console.error('Authorization error:', error);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Internal server error' }),
      };
    }
  };
}
