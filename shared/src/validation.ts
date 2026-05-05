import { z } from 'zod';

// --------------- Constants ---------------

const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_NAME_LENGTH = 100;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// --------------- Type Guards ---------------

export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'blocked' | 'done';
export type SizeTier = 'S' | 'M' | 'L' | 'XL';

const VALID_TASK_STATUSES: readonly TaskStatus[] = [
  'todo',
  'in_progress',
  'in_review',
  'blocked',
  'done',
] as const;

const VALID_SIZE_TIERS: readonly SizeTier[] = ['S', 'M', 'L', 'XL'] as const;

export function isValidTaskStatus(status: unknown): status is TaskStatus {
  return typeof status === 'string' && VALID_TASK_STATUSES.includes(status as TaskStatus);
}

export function isValidSizeTier(tier: unknown): tier is SizeTier {
  return typeof tier === 'string' && VALID_SIZE_TIERS.includes(tier as SizeTier);
}

export function isValidEmail(email: unknown): email is string {
  return typeof email === 'string' && EMAIL_REGEX.test(email);
}

export function isValidUUID(id: unknown): id is string {
  if (typeof id !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

export function isValidISODate(date: unknown): date is string {
  if (typeof date !== 'string') return false;
  const timestamp = Date.parse(date);
  return !isNaN(timestamp);
}

// --------------- Zod Schemas ---------------

export const TaskStatusSchema = z.enum(['todo', 'in_progress', 'in_review', 'blocked', 'done']);

export const SizeTierSchema = z.enum(['S', 'M', 'L', 'XL'], {
  errorMap: () => ({ message: 'sizeTier must be one of S, M, L, XL' }),
});

export const EmailSchema = z
  .string()
  .min(1, 'Email is required')
  .max(MAX_NAME_LENGTH, `Email must be ${MAX_NAME_LENGTH} characters or fewer`)
  .refine(isValidEmail, 'Invalid email format');

export const UUIDSchema = z.string().refine(isValidUUID, 'Invalid UUID format');

export const ISODateSchema = z.string().refine(isValidISODate, 'Invalid ISO date format');

export const TitleSchema = z
  .string()
  .min(1, 'Title is required')
  .max(MAX_TITLE_LENGTH, `Title must be ${MAX_TITLE_LENGTH} characters or fewer`);

export const DescriptionSchema = z
  .string()
  .max(MAX_DESCRIPTION_LENGTH, `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer`)
  .optional();

export const NameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(MAX_NAME_LENGTH, `Name must be ${MAX_NAME_LENGTH} characters or fewer`);

// --------------- Validation Helpers ---------------

export function validateRequired<T>(value: T | undefined | null, fieldName: string): T {
  if (value === undefined || value === null) {
    throw new Error(`${fieldName} is required`);
  }
  return value;
}

export function validatePositiveNumber(value: unknown, fieldName: string): number {
  if (typeof value !== 'number' || isNaN(value) || value < 0) {
    throw new Error(`${fieldName} must be a positive number`);
  }
  return value;
}

export function validateNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string`);
  }
  return value;
}

export function sanitizeString(value: string, maxLength?: number): string {
  let sanitized = value.trim();
  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  return sanitized;
}
