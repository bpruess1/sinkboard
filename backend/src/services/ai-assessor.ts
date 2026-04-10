import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { logger } from '../utils/logger.js';
import type { TaskUpdate, Task } from '@sink-board/shared';

const sqs = new SQSClient({});
const ASSESSMENT_QUEUE_URL = process.env.ASSESSMENT_QUEUE_URL!;

export interface AssessmentRequest {
  taskId: string;
  updateId: string;
  userId: string;
  updateContent: string;
  taskTitle: string;
  taskDescription?: string;
  currentDepth: number;
}

export interface AssessmentResult {
  approved: boolean;
  aiNotes: string;
  confidence: number;
}

/**
 * Publishes an assessment request to SQS for asynchronous processing
 * Returns immediately without waiting for AI assessment
 */
export async function queueAssessment(
  task: Task,
  update: TaskUpdate,
  currentDepth: number,
): Promise<void> {
  const request: AssessmentRequest = {
    taskId: task.taskId,
    updateId: update.updateId,
    userId: task.userId,
    updateContent: update.content,
    taskTitle: task.title,
    taskDescription: task.description,
    currentDepth,
  };

  try {
    const command = new SendMessageCommand({
      QueueUrl: ASSESSMENT_QUEUE_URL,
      MessageBody: JSON.stringify(request),
      MessageAttributes: {
        taskId: {
          DataType: 'String',
          StringValue: task.taskId,
        },
        userId: {
          DataType: 'String',
          StringValue: task.userId,
        },
      },
    });

    const result = await sqs.send(command);

    logger.info('Assessment queued', {
      taskId: task.taskId,
      updateId: update.updateId,
      messageId: result.MessageId,
    });
  } catch (error) {
    logger.error('Failed to queue assessment', {
      taskId: task.taskId,
      updateId: update.updateId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Legacy synchronous assessment - kept for backwards compatibility
 * @deprecated Use queueAssessment instead
 */
export async function assessUpdate(
  task: Task,
  update: TaskUpdate,
  currentDepth: number,
): Promise<AssessmentResult> {
  // For now, queue the assessment and return a default pending result
  await queueAssessment(task, update, currentDepth);

  return {
    approved: false,
    aiNotes: 'Assessment pending - will be processed asynchronously',
    confidence: 0,
  };
}
