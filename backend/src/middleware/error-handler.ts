import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Handler } from 'aws-lambda';
import { logger } from '../utils/logger.js';
import { ZodError } from 'zod';

/**
 * Standard error response structure sent to clients.
 * Contains sanitized error information without sensitive details.
 */
interface ErrorResponse {
  error: string;
  message: string;
  requestId?: string;
  details?: unknown;
}

/**
 * Custom application error class for controlled error responses.
 * Use this for expected errors that should be shown to users.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Sanitizes error messages for client response.
 * Removes sensitive information like stack traces and internal details.
 * 
 * @param error - The error object to sanitize
 * @param requestId - Request ID for tracking
 * @returns Sanitized error response object
 */
function sanitizeError(error: unknown, requestId: string): ErrorResponse {
  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return {
      error: 'ValidationError',
      message: 'Invalid request data',
      requestId,
      details: error.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    };
  }

  // Handle known application errors
  if (error instanceof AppError) {
    return {
      error: 'ApplicationError',
      message: error.message,
      requestId,
      details: error.details,
    };
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    // In production, don't expose internal error messages
    const message = process.env.NODE_ENV === 'production'
      ? 'An internal error occurred'
      : error.message;

    return {
      error: error.name || 'Error',
      message,
      requestId,
    };
  }

  // Handle unknown error types
  return {
    error: 'UnknownError',
    message: 'An unexpected error occurred',
    requestId,
  };
}

/**
 * Determines HTTP status code based on error type.
 * 
 * @param error - The error object
 * @returns Appropriate HTTP status code
 */
function getStatusCode(error: unknown): number {
  if (error instanceof AppError) {
    return error.statusCode;
  }
  if (error instanceof ZodError) {
    return 400;
  }
  return 500;
}

/**
 * Error handling middleware that wraps Lambda handlers.
 * Catches all errors, logs them with full context, and returns sanitized responses to clients.
 * 
 * Usage:
 *   export const handler = withErrorHandling(async (event) => {
 *     // handler logic
 *   });
 * 
 * @param handler - The Lambda handler function to wrap
 * @returns Wrapped handler with error handling
 */
export function withErrorHandling(
  handler: Handler<APIGatewayProxyEventV2, APIGatewayProxyResultV2>,
): Handler<APIGatewayProxyEventV2, APIGatewayProxyResultV2> {
  return async (event, context) => {
    const requestId = context.requestId;
    const startTime = Date.now();

    // Log incoming request
    logger.info({
      event: 'request_start',
      requestId,
      path: event.rawPath,
      method: event.requestContext.http.method,
      sourceIp: event.requestContext.http.sourceIp,
    });

    try {
      const result = await handler(event, context);
      const duration = Date.now() - startTime;

      // Log successful response
      logger.info({
        event: 'request_complete',
        requestId,
        statusCode: result.statusCode || 200,
        duration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const statusCode = getStatusCode(error);
      const sanitizedError = sanitizeError(error, requestId);

      // Log full error details server-side
      logger.error({
        event: 'request_error',
        requestId,
        statusCode,
        duration,
        error: {
          name: error instanceof Error ? error.name : 'Unknown',
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          details: error instanceof AppError ? error.details : undefined,
        },
        path: event.rawPath,
        method: event.requestContext.http.method,
      });

      // Return sanitized error to client
      return {
        statusCode,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sanitizedError),
      };
    }
  };
}
