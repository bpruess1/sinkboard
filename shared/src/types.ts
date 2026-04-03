export type SizeTier = 'S' | 'M' | 'L' | 'XL';
export type TaskStatus = 'active' | 'completed' | 'sunk';

export interface User {
  userId: string;
  email: string;
  displayName: string;
  score: number;
  createdAt: string;
}

export interface Task {
  taskId: string;
  userId: string;
  title: string;
  description: string;
  sizeTier: SizeTier;
  value: number;
  currentDepthPercent: number;
  lastRaisedAt: string;
  status: TaskStatus;
  jewelLevel: number;
  krakenCount: number;
  createdAt: string;
}

export interface TaskUpdate {
  updateId: string;
  taskId: string;
  userId: string;
  content: string;
  aiScore: number;
  raisePercent: number;
  createdAt: string;
}

// API request types
export interface CreateTaskRequest {
  title: string;
  description?: string;
  sizeTier: SizeTier;
}

export interface SubmitUpdateRequest {
  content: string;
}

// API response types
export interface SubmitUpdateResponse {
  update: TaskUpdate;
  newDepthPercent: number;
  aiScore: number;
  raisePercent: number;
}

export interface KrakenTookResponse {
  task: Task;
  pointsLost: number;
  newScore: number;
}

export interface CompleteTaskResponse {
  task: Task;
  pointsGained: number;
  newScore: number;
}
