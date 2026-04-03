import type {
  Task,
  CreateTaskRequest,
  CompleteTaskResponse,
  SubmitUpdateResponse,
  KrakenTookResponse,
} from '@sink-board/shared';
import { apiFetch } from './client';

export function getTasks(): Promise<Task[]> {
  return apiFetch<Task[]>('/tasks');
}

export function createTask(input: CreateTaskRequest): Promise<Task> {
  return apiFetch<Task>('/tasks', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function completeTask(taskId: string): Promise<CompleteTaskResponse> {
  return apiFetch<CompleteTaskResponse>(`/tasks/${taskId}/complete`, {
    method: 'PUT',
  });
}

export function submitUpdate(taskId: string, content: string): Promise<SubmitUpdateResponse> {
  return apiFetch<SubmitUpdateResponse>(`/tasks/${taskId}/updates`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

export function krakenTook(taskId: string): Promise<KrakenTookResponse> {
  return apiFetch<KrakenTookResponse>(`/tasks/${taskId}/kraken`, {
    method: 'POST',
  });
}
