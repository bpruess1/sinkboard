import { useQuery } from '@tanstack/react-query';
import type { User } from '@sink-board/shared';
import { getMe } from '../api/user';

export function useUser() {
  return useQuery<User>({
    queryKey: ['user'],
    queryFn: getMe,
    staleTime: 5 * 60_000,
  });
}
