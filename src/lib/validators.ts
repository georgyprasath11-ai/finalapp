import { z } from 'zod'

export const emailSchema = z
  .string()
  .email('Enter a valid email address')
  .max(254, 'Email is too long')
  .trim()
  .toLowerCase()

export const otpTokenSchema = z
  .string()
  .length(6, 'Code must be exactly 6 digits')
  .regex(/^\d{6}$/, 'Digits only - no letters or spaces')

export const taskTitleSchema = z
  .string()
  .min(1, 'Title is required')
  .max(500, 'Title must be under 500 characters')
  .trim()

export const subjectNameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(100, 'Name must be under 100 characters')
  .trim()

export const profileNameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(50, 'Name must be under 50 characters')
  .trim()

export const reflectionCommentSchema = z
  .string()
  .max(300, 'Keep it under 300 characters')
  .trim()

export const goalHoursSchema = z
  .number()
  .min(0, 'Must be 0 or more')
  .max(24, 'Maximum is 24 hours')
