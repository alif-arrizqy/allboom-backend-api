import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { PaginationResult } from '../utils/pagination';
import { ErrorMessages } from '../constants/error-messages';

export interface PortfolioFilters {
  mediaTypeId?: string;
  studentId?: string;
  classId?: string;
  search?: string;
  minGrade?: number;
  sortBy?: 'grade' | 'submittedAt' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export class PortfolioService {
  async findPortfolioItems(filters: PortfolioFilters, pagination: PaginationResult) {
    const where: Prisma.SubmissionWhereInput = {
      status: 'GRADED', // Only show graded submissions
    };

    if (filters.studentId) {
      where.studentId = filters.studentId;
    }

    if (filters.classId) {
      where.student = {
        classId: filters.classId,
      };
    }

    if (filters.mediaTypeId) {
      where.assignment = {
        mediaTypeId: filters.mediaTypeId,
      };
    }

    if (filters.minGrade !== undefined) {
      where.grade = {
        gte: filters.minGrade,
      };
    }

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { student: { name: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    const sortBy = filters.sortBy || 'submittedAt';
    const sortOrder = filters.sortOrder || 'desc';

    const orderBy: any = {};
    if (sortBy === 'grade') {
      orderBy.grade = sortOrder;
    } else if (sortBy === 'title') {
      orderBy.title = sortOrder;
    } else {
      orderBy.submittedAt = sortOrder;
    }

    const [items, total] = await Promise.all([
      prisma.submission.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          imageUrl: true,
          imageThumbnail: true,
          imageMedium: true,
          grade: true,
          feedback: true,
          submittedAt: true,
          gradedAt: true,
          student: {
            select: {
              id: true,
              name: true,
              nis: true,
              className: true,
              avatar: true,
            },
          },
          assignment: {
            select: {
              id: true,
              title: true,
              mediaType: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                },
              },
            },
          },
        },
        skip: pagination.skip,
        take: pagination.take,
        orderBy,
      }),
      prisma.submission.count({ where }),
    ]);

    return { items, total };
  }

  async findPortfolioItemById(itemId: string) {
    try {
      const item = await prisma.submission.findUnique({
        where: { id: itemId },
        select: {
          id: true,
          title: true,
          description: true,
          imageUrl: true,
          imageThumbnail: true,
          imageMedium: true,
          grade: true,
          feedback: true,
          submittedAt: true,
          gradedAt: true,
          student: {
            select: {
              id: true,
              name: true,
              nis: true,
              className: true,
              avatar: true,
            },
          },
          assignment: {
            select: {
              id: true,
              title: true,
              description: true,
              mediaType: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                },
              },
            },
          },
        },
      });

      if (!item) {
        throw new Error(ErrorMessages.RESOURCE.NOT_FOUND);
      }

      // Check if submission is graded
      if (item.grade === null) {
        throw new Error('Portfolio item not found');
      }

      return item;
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error(ErrorMessages.RESOURCE.NOT_FOUND);
        }
      }
      throw error;
    }
  }
}

export default new PortfolioService();

