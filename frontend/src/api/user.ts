import type { User } from '@sink-board/shared';
import { apiFetch } from './client';

export function getMe(): Promise<User> {
  return apiFetch<User>('/me');
}
