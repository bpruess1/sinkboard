import { z } from 'zod';

/**
 * Schema for submitting a task update.
 * Validates the update text content.
 */
export const SubmitUpdateRequestSchema = z.object({
  updateText: z.string().min(1, 'Update text is required').max(5000, 'Update text must be 5000 characters or fewer'),
});

/**
 * Schema for path parameters when submitting an update.
 * Validates the taskId from the URL path.
 */
export const SubmitUpdatePathSchema = z.object({
  taskId: z.string().uuid('taskId must be a valid UUID'),
});
