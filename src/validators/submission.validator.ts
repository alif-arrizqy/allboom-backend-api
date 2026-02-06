import { z } from 'zod';
import { SubmissionStatus } from '@prisma/client';

export const createSubmissionSchema = z.object({
  assignmentId: z.string().uuid('Invalid assignment ID'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  mediaTypeId: z.string().uuid().optional(),
  artworkSize: z.string().max(50).optional(),
  yearCreated: z.number().int().min(1900).max(new Date().getFullYear()).optional(),
});

export const updateSubmissionSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  mediaTypeId: z.string().uuid().optional(),
  artworkSize: z.string().max(50).optional(),
  yearCreated: z.number().int().min(1900).max(new Date().getFullYear()).optional(),
});

export const querySubmissionsSchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional().default(() => 1),
  limit: z.string().transform(Number).pipe(z.number().int().positive().max(100)).optional().default(() => 10),
  assignmentId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
  status: z.nativeEnum(SubmissionStatus).optional(),
  search: z.string().optional(),
});

export const returnForRevisionSchema = z.object({
  revisionNote: z.string().min(1, 'Revision note is required'),
});

