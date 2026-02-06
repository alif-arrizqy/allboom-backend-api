import { z } from 'zod';

export const queryPortfolioSchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional().default(() => 1),
  limit: z.string().transform(Number).pipe(z.number().int().positive().max(100)).optional().default(() => 10),
  mediaTypeId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
  search: z.string().optional(),
  minGrade: z.string().transform(Number).pipe(z.number().int().min(0).max(100)).optional(),
  sortBy: z.enum(['grade', 'submittedAt', 'title']).optional().default('submittedAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

