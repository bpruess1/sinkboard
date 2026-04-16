// --------------- Core Types ---------------

export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'blocked' | 'done';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  assigneeId?: string;
  position?: number;
  blockedReason?: string;
  blockedBy?: string;
  blockedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface Assessment {
  id: string;
  taskId: string;
  score: number;
  feedback: string;
  assessedAt: string;
  assessedBy?: string;
}

// --------------- API Types ---------------

export interface CreateTaskRequest {
  title: string;
  description?: string;
  status?: TaskStatus;
  assigneeId?: string;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  status?: TaskStatus;
  assigneeId?: string;
  blockedReason?: string;
  blockedBy?: string;
}

export interface MoveTaskRequest {
  newPosition?: number;
  newStatus?: TaskStatus;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

// --------------- Validation Types ---------------

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

export interface TaskMoveValidation {
  allowed: boolean;
  reason?: string;
}
