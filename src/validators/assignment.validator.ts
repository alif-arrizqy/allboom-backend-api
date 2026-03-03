import { z } from 'zod';
import { AssignmentStatus } from '@prisma/client';

const materiTypeEnum = z.enum(['FILE', 'LINK']).optional().nullable();

// Validates a URL for materi field (optional, nullable, or empty string for clearing)
const materiUrlSchema = z
  .string()
  .url('URL materi tidak valid')
  .optional()
  .nullable()
  .or(z.literal(''));

export const createAssignmentSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  mediaTypeId: z.string().uuid('Media Type ID must be a valid UUID'),
  artworkSize: z.string().optional(),
  materiUrl: materiUrlSchema,
  materiType: materiTypeEnum,
  deadline: z.string().datetime().or(z.date()),
  status: z.nativeEnum(AssignmentStatus).default(AssignmentStatus.DRAFT),
  classIds: z.array(z.string().uuid()).min(1, 'At least one class is required'),
});

export const updateAssignmentSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  mediaTypeId: z.string().uuid('Media Type ID must be a valid UUID').optional(),
  artworkSize: z.string().optional(),
  materiUrl: materiUrlSchema,
  materiType: materiTypeEnum,
  deadline: z.string().datetime().or(z.date()).optional(),
  status: z.nativeEnum(AssignmentStatus).optional(),
  classIds: z.array(z.string().uuid()).optional(),
});

export const queryAssignmentsSchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional().default(() => 1),
  limit: z.string().transform(Number).pipe(z.number().int().positive().max(100)).optional().default(() => 10),
  status: z.nativeEnum(AssignmentStatus).optional(),
  mediaTypeId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
  search: z.string().optional(),
});

export const gradeSubmissionSchema = z.object({
  grade: z.number().int().min(0).max(100),
  feedback: z.string().optional(),
});

export const bulkStatusSchema = z.object({
  assignmentIds: z.array(z.string().uuid()).min(1),
  status: z.nativeEnum(AssignmentStatus),
});

export const bulkDeleteSchema = z.object({
  assignmentIds: z.array(z.string().uuid()).min(1),
});

