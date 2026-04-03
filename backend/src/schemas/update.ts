import { z } from 'zod';

export const SubmitUpdateRequestSchema = z.object({
  content: z
    .string()
    .min(10, 'Update content must be at least 10 characters')
    .max(5000, 'Update content must be 5000 characters or fewer'),
});
