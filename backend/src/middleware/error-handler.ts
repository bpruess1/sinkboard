import type { APIGatewayProxyResultV2 } from 'aws-lambda';
import { AuthenticationError, AuthorizationError } from './auth.js';
import { ValidationError } from '@sink-board/shared';
import { ZodError } from 'zod';

// --------------- Error Response Types ---------------

interface ErrorResponse {
  error: string;
  message: string;
  details?: unknown;
}

interface ErrorMapping {
  statusCode: number;
  error: string;
}

// --------------- Error Mappings ---------------

const ERROR_MAPPINGS: Record<string, ErrorMapping> = {
  AuthenticationError: { statusCode: 401, error: 'Unauthorized' },
  AuthorizationError: { statusCode: 403, error: 'Forbidden' },
  ValidationError: { statusCode: 400, error: 'Bad Request' },
  ZodError: { statusCode: 400, error: 'Validation Failed' },
  NotFoundError: { statusCode: 404, error: 'Not Found' },
  ConflictError: { statusCode: 409, error: 'Conflict' },
};

const DEFAULT_ERROR_MAPPING: ErrorMapping = {
  statusCode: 500,
  error: 'Internal Server Error',
};

// --------------- Custom Error Classes ---------------

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

// --------------- Error Handler ---------------

function getErrorMapping(error: Error): ErrorMapping {
  const mapping = ERROR_MAPPINGS[error.name];
  return mapping || DEFAULT_ERROR_MAPPING;
}

function formatZodError(error: ZodError): unknown {
  return error.errors.map((err) => ({
    path: err.path.join('.'),
    message: err.message,
  }));
}

function shouldLogError(statusCode: number): boolean {
  return statusCode >= 500;
}

export function handleError(error: unknown): APIGatewayProxyResultV2 {
  // Handle non-Error objects
  if (!(error instanceof Error)) {
    console.error('Non-Error thrown:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
      }),
    };
  }

  const mapping = getErrorMapping(error);
  const response: ErrorResponse = {
    error: mapping.error,
    message: error.message,
  };

  // Add details for validation errors
  if (error instanceof ZodError) {
    response.details = formatZodError(error);
  }

  // Log server errors
  if (shouldLogError(mapping.statusCode)) {
    console.error('Error:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
  }

  return {
    statusCode: mapping.statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(response),
  };
}

// --------------- Response Helpers ---------------

export function successResponse(
  data: unknown,
  statusCode: number = 200,
): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  };
}

export function createdResponse(data: unknown): APIGatewayProxyResultV2 {
  return successResponse(data, 201);
}

export function noContentResponse(): APIGatewayProxyResultV2 {
  return {
    statusCode: 204,
    body: '',
  };
}
