import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getUserId } from '../middleware/auth.js';
import { getTasksForUser } from '../services/dynamo.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Lambda handler to retrieve paginated tasks for the authenticated user.
 * 
 * Query parameters:
 * - limit: Number of tasks to return (default: 20, max: 100)
 * - nextToken: Base64-encoded pagination token from previous response
 * 
 * Response format:
 * {
 *   tasks: Task[],
 *   nextToken?: string  // Present if more results available
 * }
 * 
 * @param event - API Gateway event with authentication context
 * @returns Paginated list of tasks with optional nextToken
 */
export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  try {
    const userId = getUserId(event);

    // Parse pagination parameters
    const limitParam = event.queryStringParameters?.limit;
    const nextTokenParam = event.queryStringParameters?.nextToken;

    let limit = DEFAULT_LIMIT;
    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0) {
        limit = Math.min(parsedLimit, MAX_LIMIT);
      }
    }

    // Decode nextToken if provided
    let lastEvaluatedKey: Record<string, any> | undefined;
    if (nextTokenParam) {
      try {
        const decoded = Buffer.from(nextTokenParam, 'base64').toString('utf-8');
        lastEvaluatedKey = JSON.parse(decoded);
      } catch (error) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Invalid nextToken format' }),
        };
      }
    }

    // Query tasks with pagination
    const result = await getTasksForUser(userId, limit, lastEvaluatedKey);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to fetch tasks' }),
    };
  }
};
