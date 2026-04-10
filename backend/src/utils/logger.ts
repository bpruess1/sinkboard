import pino from 'pino';

/**
 * Log level configuration per environment.
 * Development: debug and above
 * Production: info and above
 * Test: warn and above (minimize noise in tests)
 */
const LOG_LEVEL = process.env.LOG_LEVEL || 
  (process.env.NODE_ENV === 'production' ? 'info' :
   process.env.NODE_ENV === 'test' ? 'warn' : 'debug');

/**
 * Structured JSON logger using Pino.
 * Configured for Lambda environment with request correlation.
 * 
 * Features:
 * - Structured JSON output for CloudWatch Logs Insights
 * - ISO timestamp format
 * - Request ID correlation
 * - Environment-specific log levels
 * - No pretty printing in production (smaller bundle, faster logs)
 * 
 * Usage:
 *   logger.info({ event: 'user_created', userId: '123' }, 'User created');
 *   logger.error({ error: err, context: 'task-creation' }, 'Failed to create task');
 *   logger.debug({ requestData }, 'Processing request');
 */
export const logger = pino({
  level: LOG_LEVEL,
  
  // Lambda environment - structured JSON only
  formatters: {
    level: (label) => {
      return { level: label };
    },
    bindings: (bindings) => {
      return {
        runtime: 'aws-lambda',
        // Remove default pid/hostname in Lambda (not useful)
      };
    },
  },

  // ISO timestamps for consistent parsing
  timestamp: pino.stdTimeFunctions.isoTime,

  // Serialize errors with stack traces
  serializers: {
    error: pino.stdSerializers.err,
    err: pino.stdSerializers.err,
  },

  // Pretty print in development only
  ...(process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test'
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      }
    : {}),
});

/**
 * Creates a child logger with persistent context.
 * Use this to add request-specific or operation-specific context.
 * 
 * @param bindings - Context to include in all log messages from this logger
 * @returns Child logger instance
 * 
 * Example:
 *   const reqLogger = logger.child({ requestId: context.requestId, userId });
 *   reqLogger.info('Processing task creation');
 */
export function createLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}
