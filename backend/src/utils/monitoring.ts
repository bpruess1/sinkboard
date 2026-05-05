import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';

// --------------- Configuration ---------------

const SENTRY_DSN = process.env.SENTRY_DSN;
const ENVIRONMENT = process.env.ENVIRONMENT || 'development';
const SERVICE_NAME = process.env.SERVICE_NAME || 'sink-board-backend';
const ENABLE_TRACING = process.env.ENABLE_TRACING === 'true';
const SAMPLE_RATE = parseFloat(process.env.SAMPLE_RATE || '1.0');
const TRACES_SAMPLE_RATE = parseFloat(process.env.TRACES_SAMPLE_RATE || '0.1');

let isInitialized = false;

// --------------- Initialization ---------------

export function initializeMonitoring(): void {
  if (isInitialized) {
    return;
  }

  if (!SENTRY_DSN) {
    console.warn('SENTRY_DSN not configured, monitoring disabled');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,
    serverName: SERVICE_NAME,
    sampleRate: SAMPLE_RATE,
    tracesSampleRate: TRACES_SAMPLE_RATE,
    profilesSampleRate: ENABLE_TRACING ? 0.1 : 0,
    integrations: ENABLE_TRACING ? [new ProfilingIntegration()] : [],
    beforeSend(event) {
      // Filter out sensitive data
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
      }
      return event;
    },
  });

  isInitialized = true;
  console.log(`Monitoring initialized for ${ENVIRONMENT}`);
}

// --------------- Error Tracking ---------------

export interface ErrorContext {
  userId?: string;
  taskId?: string;
  operation?: string;
  metadata?: Record<string, unknown>;
}

export function captureError(error: Error, context?: ErrorContext): void {
  if (!isInitialized) {
    console.error('Error captured (monitoring not initialized):', error);
    return;
  }

  Sentry.withScope((scope) => {
    if (context?.userId) {
      scope.setUser({ id: context.userId });
    }
    if (context?.operation) {
      scope.setTag('operation', context.operation);
    }
    if (context?.taskId) {
      scope.setContext('task', { taskId: context.taskId });
    }
    if (context?.metadata) {
      scope.setContext('metadata', context.metadata);
    }
    Sentry.captureException(error);
  });
}

// --------------- Metrics Collection ---------------

export interface MetricTags {
  operation?: string;
  status?: string;
  userId?: string;
  [key: string]: string | undefined;
}

export function recordMetric(
  name: string,
  value: number,
  tags?: MetricTags,
): void {
  // CloudWatch compatible metric logging
  const metric = {
    timestamp: new Date().toISOString(),
    metric: name,
    value,
    unit: 'None',
    environment: ENVIRONMENT,
    service: SERVICE_NAME,
    ...tags,
  };

  console.log('METRIC:', JSON.stringify(metric));
}

export function recordLatency(
  operation: string,
  durationMs: number,
  tags?: MetricTags,
): void {
  recordMetric('operation.latency', durationMs, {
    operation,
    ...tags,
  });
}

// --------------- Performance Monitoring ---------------

export interface PerformanceTimer {
  end: (tags?: MetricTags) => void;
}

export function startTimer(operation: string): PerformanceTimer {
  const startTime = Date.now();

  return {
    end: (tags?: MetricTags) => {
      const duration = Date.now() - startTime;
      recordLatency(operation, duration, tags);
    },
  };
}

// --------------- Logging Aggregation ---------------

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface StructuredLog {
  level: LogLevel;
  message: string;
  timestamp: string;
  service: string;
  environment: string;
  userId?: string;
  operation?: string;
  metadata?: Record<string, unknown>;
}

export function logStructured(
  level: LogLevel,
  message: string,
  context?: Omit<StructuredLog, 'level' | 'message' | 'timestamp' | 'service' | 'environment'>,
): void {
  const log: StructuredLog = {
    level,
    message,
    timestamp: new Date().toISOString(),
    service: SERVICE_NAME,
    environment: ENVIRONMENT,
    ...context,
  };

  console.log(JSON.stringify(log));
}
