import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context } from 'aws-lambda';
import {
  initializeMonitoring,
  captureError,
  startTimer,
  recordMetric,
  logStructured,
  type ErrorContext,
} from '../utils/monitoring.js';

// --------------- Types ---------------

export type LambdaHandler = (
  event: APIGatewayProxyEventV2,
  context: Context,
) => Promise<APIGatewayProxyResultV2>;

// --------------- Middleware ---------------

export function withMonitoring(handler: LambdaHandler): LambdaHandler {
  initializeMonitoring();

  return async (event: APIGatewayProxyEventV2, context: Context): Promise<APIGatewayProxyResultV2> => {
    const timer = startTimer('lambda.invocation');
    const operation = event.routeKey || event.rawPath || 'unknown';
    const requestId = context.requestId;

    logStructured('info', 'Request started', {
      operation,
      metadata: {
        requestId,
        method: event.requestContext.http.method,
        path: event.rawPath,
      },
    });

    // Track cold start
    const isColdStart = !global.isWarm;
    if (isColdStart) {
      recordMetric('lambda.cold_start', 1, { operation });
      global.isWarm = true;
    }

    try {
      const result = await handler(event, context);
      const statusCode = result.statusCode || 200;

      timer.end({
        operation,
        status: statusCode.toString(),
      });

      recordMetric('lambda.invocation', 1, {
        operation,
        status: statusCode.toString(),
      });

      logStructured('info', 'Request completed', {
        operation,
        metadata: {
          requestId,
          statusCode,
        },
      });

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      timer.end({
        operation,
        status: 'error',
      });

      recordMetric('lambda.error', 1, {
        operation,
        error: err.name,
      });

      const errorContext: ErrorContext = {
        operation,
        metadata: {
          requestId,
          path: event.rawPath,
          method: event.requestContext.http.method,
        },
      };

      captureError(err, errorContext);

      logStructured('error', 'Request failed', {
        operation,
        metadata: {
          requestId,
          error: err.message,
          stack: err.stack,
        },
      });

      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Internal Server Error',
          requestId,
        }),
      };
    }
  };
}

// --------------- Global State ---------------

declare global {
  // eslint-disable-next-line no-var
  var isWarm: boolean | undefined;
}
