import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Task, CreateTaskRequest } from '@sink-board/shared';
import * as tasksApi from '../api/tasks';

const TASKS_KEY = ['tasks'] as const;

export function useTasks() {
  return useQuery<Task[]>({
    queryKey: TASKS_KEY,
    queryFn: tasksApi.getTasks,
    staleTime: 60_000,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskRequest) => tasksApi.createTask(input),
    onSuccess: (newTask) => {
      queryClient.setQueryData<Task[]>(TASKS_KEY, (old) =>
        old ? [...old, newTask] : [newTask]
      );
    },
  });
}

export function useCompleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => tasksApi.completeTask(taskId),
    onSuccess: (response) => {
      queryClient.setQueryData<Task[]>(TASKS_KEY, (old) =>
        old
          ? old.map((t) => (t.taskId === response.task.taskId ? response.task : t))
          : []
      );
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });
}

export function useSubmitUpdate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, content }: { taskId: string; content: string }) =>
      tasksApi.submitUpdate(taskId, content),
    onSuccess: (response, { taskId }) => {
      queryClient.setQueryData<Task[]>(TASKS_KEY, (old) =>
        old
          ? old.map((t) =>
              t.taskId === taskId
                ? { ...t, currentDepthPercent: response.newDepthPercent, lastRaisedAt: response.update.createdAt }
                : t
            )
          : []
      );
    },
  });
}

export function useKrakenTook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => tasksApi.krakenTook(taskId),
    onSuccess: (response) => {
      queryClient.setQueryData<Task[]>(TASKS_KEY, (old) =>
        old
          ? old.map((t) => (t.taskId === response.task.taskId ? response.task : t))
          : []
      );
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });
}
