import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import type { ZodSchema } from 'zod';
import { z } from 'zod';

/**
 * Handler function type that accepts validated input.
 */
type ValidatedHandler<TBody> = (
  event: APIGatewayProxyEventV2,
  validatedBody: TBody,
) => Promise<APIGatewayProxyResultV2>;

/**
 * Middleware that validates request body against a Zod schema.
 * Returns 400 Bad Request if validation fails with detailed error messages.
 * 
 * @param schema - Zod schema to validate the request body against
 * @param handler - Handler function that receives the validated body
 * @returns Lambda handler function with validation applied
 * 
 * @example
 * ```typescript
 * export const handler = validateBody(
 *   CreateTaskRequestSchema,
 *   async (event, validatedBody) => {
 *     // validatedBody is type-safe and validated
 *     return { statusCode: 200, body: JSON.stringify(validatedBody) };
 *   }
 * );
 * ```
 */
export function validateBody<TBody>(
  schema: ZodSchema<TBody>,
  handler: ValidatedHandler<TBody>,
) {
  return async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    try {
      const body = event.body ? JSON.parse(event.body) : {};
      const validatedBody = schema.parse(body);
      return await handler(event, validatedBody);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: 'Validation failed',
            details: error.errors.map((err) => ({
              path: err.path.join('.'),
              message: err.message,
            })),
          }),
        };
      }
      
      if (error instanceof SyntaxError) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: 'Invalid JSON in request body',
          }),
        };
      }
      
      throw error;
    }
  };
}

/**
 * Middleware that validates path parameters against a Zod schema.
 * Returns 400 Bad Request if validation fails with detailed error messages.
 * 
 * @param schema - Zod schema to validate the path parameters against
 * @param handler - Handler function that receives the validated path parameters
 * @returns Lambda handler function with path validation applied
 * 
 * @example
 * ```typescript
 * export const handler = validatePath(
 *   TaskIdPathSchema,
 *   async (event, validatedParams) => {
 *     const { taskId } = validatedParams;
 *     // taskId is validated as UUID
 *   }
 * );
 * ```
 */
export function validatePath<TParams>(
  schema: ZodSchema<TParams>,
  handler: ValidatedHandler<TParams>,
) {
  return async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    try {
      const validatedParams = schema.parse(event.pathParameters || {});
      return await handler(event, validatedParams);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: 'Invalid path parameters',
            details: error.errors.map((err) => ({
              path: err.path.join('.'),
              message: err.message,
            })),
          }),
        };
      }
      
      throw error;
    }
  };
}

/**
 * Middleware that validates query string parameters against a Zod schema.
 * Returns 400 Bad Request if validation fails with detailed error messages.
 * 
 * @param schema - Zod schema to validate the query parameters against
 * @param handler - Handler function that receives the validated query parameters
 * @returns Lambda handler function with query validation applied
 */
export function validateQuery<TQuery>(
  schema: ZodSchema<TQuery>,
  handler: ValidatedHandler<TQuery>,
) {
  return async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    try {
      const validatedQuery = schema.parse(event.queryStringParameters || {});
      return await handler(event, validatedQuery);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: 'Invalid query parameters',
            details: error.errors.map((err) => ({
              path: err.path.join('.'),
              message: err.message,
            })),
          }),
        };
      }
      
      throw error;
    }
  };
}
