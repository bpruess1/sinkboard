import { z } from 'zod';

export const CreateTaskRequestSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be 200 characters or fewer'),
  description: z.string().max(2000, 'Description must be 2000 characters or fewer').optional(),
  sizeTier: z.enum(['S', 'M', 'L', 'XL'], {
    errorMap: () => ({ message: 'sizeTier must be one of S, M, L, XL' }),
  }),
});
