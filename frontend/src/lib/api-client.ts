/**
 * API client for sink-board backend operations.
 * 
 * This module provides a type-safe HTTP client for interacting with the backend API.
 * Authentication and error handling are configured via dependency injection through
 * ApiClientConfig, making the client testable and removing global mutable state.
 * 
 * @example
 * ```typescript
 * const config: ApiClientConfig = {
 *   baseUrl: import.meta.env.VITE_API_URL,
 *   getIdToken: async () => await auth0.getAccessTokenSilently(),
 *   onUnauthorized: () => window.location.href = '/login'
 * };
 * const client = createApiClient(config);
 * const tasks = await client.getTasks();
 * ```
 */

import type { Task, CreateTaskRequest, TaskUpdate, SubmitUpdateRequest, User } from '@sink-board/shared';

/**
 * Configuration for API client dependency injection.
 * Allows customization of authentication and error handling without global state.
 */
export interface ApiClientConfig {
  /** Base URL for API requests (e.g., 'https://api.example.com') */
  baseUrl: string;
  /** Async function to retrieve current ID token for Authorization header */
  getIdToken: () => Promise<string>;
  /** Callback invoked when API returns 401 Unauthorized */
  onUnauthorized: () => void;
}

/**
 * Type-safe API client interface for all backend operations.
 * All methods throw ApiError on failure.
 */
export interface ApiClient {
  getTasks(): Promise<Task[]>;
  getTask(taskId: string): Promise<Task>;
  createTask(data: CreateTaskRequest): Promise<Task>;
  submitUpdate(taskId: string, data: SubmitUpdateRequest): Promise<TaskUpdate>;
  getMe(): Promise<User>;
}

/**
 * Structured error thrown by API client operations.
 * Includes HTTP status code and parsed error message from backend.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly responseBody?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Creates an API client instance with injected dependencies.
 * 
 * @param config - Configuration object with baseUrl, token getter, and error handler
 * @returns ApiClient instance with all backend operation methods
 */
export function createApiClient(config: ApiClientConfig): ApiClient {
  const { baseUrl, getIdToken, onUnauthorized } = config;

  /**
   * Internal helper to make authenticated HTTP requests.
   * Automatically adds Authorization header and handles common error cases.
   * 
   * @param path - API endpoint path (e.g., '/tasks')
   * @param options - Fetch options (method, body, etc.)
   * @returns Parsed JSON response
   * @throws ApiError on HTTP errors or network failures
   */
  async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const idToken = await getIdToken();

    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
        ...options.headers,
      },
    });

    if (response.status === 401) {
      onUnauthorized();
      throw new ApiError('Unauthorized', 401);
    }

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      let responseBody: unknown;

      try {
        responseBody = await response.json();
        if (responseBody && typeof responseBody === 'object' && 'message' in responseBody) {
          errorMessage = String(responseBody.message);
        }
      } catch {
        // Response body not JSON, use status text
      }

      throw new ApiError(errorMessage, response.status, responseBody);
    }

    return response.json();
  }

  return {
    async getTasks(): Promise<Task[]> {
      return request<Task[]>('/tasks');
    },

    async getTask(taskId: string): Promise<Task> {
      return request<Task>(`/tasks/${encodeURIComponent(taskId)}`);
    },

    async createTask(data: CreateTaskRequest): Promise<Task> {
      return request<Task>('/tasks', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async submitUpdate(taskId: string, data: SubmitUpdateRequest): Promise<TaskUpdate> {
      return request<TaskUpdate>(`/tasks/${encodeURIComponent(taskId)}/updates`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async getMe(): Promise<User> {
      return request<User>('/me');
    },
  };
}
