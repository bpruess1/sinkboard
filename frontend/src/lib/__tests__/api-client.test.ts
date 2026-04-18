/**
 * Unit tests for API client with mocked fetch.
 * Tests dependency injection, error handling, and request formatting.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createApiClient, ApiError, type ApiClientConfig } from '../api-client';
import type { Task, CreateTaskRequest, User } from '@sink-board/shared';

const BASE_URL = 'https://api.example.com';
const MOCK_TOKEN = 'mock-id-token';

describe('createApiClient', () => {
  let mockGetIdToken: () => Promise<string>;
  let mockOnUnauthorized: () => void;
  let config: ApiClientConfig;

  beforeEach(() => {
    mockGetIdToken = vi.fn().mockResolvedValue(MOCK_TOKEN);
    mockOnUnauthorized = vi.fn();
    config = {
      baseUrl: BASE_URL,
      getIdToken: mockGetIdToken,
      onUnauthorized: mockOnUnauthorized,
    };
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getTasks', () => {
    it('should fetch tasks with authorization header', async () => {
      const mockTasks: Task[] = [
        { taskId: '1', userId: 'user1', title: 'Task 1', sizeTier: 'M', depthPerc: 0, createdAt: 1000 },
      ];
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockTasks,
      });

      const client = createApiClient(config);
      const tasks = await client.getTasks();

      expect(tasks).toEqual(mockTasks);
      expect(global.fetch).toHaveBeenCalledWith(`${BASE_URL}/tasks`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${MOCK_TOKEN}`,
        },
      });
      expect(mockGetIdToken).toHaveBeenCalled();
    });
  });

  describe('createTask', () => {
    it('should send POST request with task data', async () => {
      const taskData: CreateTaskRequest = { title: 'New Task', sizeTier: 'L' };
      const createdTask: Task = { taskId: '2', userId: 'user1', ...taskData, depthPerc: 0, createdAt: 2000 };
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => createdTask,
      });

      const client = createApiClient(config);
      const task = await client.createTask(taskData);

      expect(task).toEqual(createdTask);
      expect(global.fetch).toHaveBeenCalledWith(`${BASE_URL}/tasks`, {
        method: 'POST',
        body: JSON.stringify(taskData),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${MOCK_TOKEN}`,
        },
      });
    });
  });

  describe('error handling', () => {
    it('should throw ApiError on non-ok response', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ message: 'Invalid input' }),
      });

      const client = createApiClient(config);
      await expect(client.getTasks()).rejects.toThrow(ApiError);
      await expect(client.getTasks()).rejects.toThrow('Invalid input');
    });

    it('should call onUnauthorized on 401 response', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      const client = createApiClient(config);
      await expect(client.getTasks()).rejects.toThrow(ApiError);
      expect(mockOnUnauthorized).toHaveBeenCalled();
    });

    it('should handle non-JSON error responses', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => {
          throw new Error('Not JSON');
        },
      });

      const client = createApiClient(config);
      await expect(client.getTasks()).rejects.toThrow('HTTP 500: Internal Server Error');
    });
  });

  describe('getMe', () => {
    it('should fetch current user', async () => {
      const mockUser: User = { userId: 'user1', email: 'test@example.com', createdAt: 1000 };
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockUser,
      });

      const client = createApiClient(config);
      const user = await client.getMe();

      expect(user).toEqual(mockUser);
      expect(global.fetch).toHaveBeenCalledWith(`${BASE_URL}/me`, expect.any(Object));
    });
  });
});
