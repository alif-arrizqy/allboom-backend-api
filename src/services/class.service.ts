import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { PaginationResult } from '../utils/pagination';
import { ErrorMessages } from '../constants/error-messages';

export interface ClassFilters {
  search?: string;
  teacherId?: string;
}

export class ClassService {
  async findClasses(filters: ClassFilters, pagination: PaginationResult) {
    const where: any = {};

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.teacherId) {
      where.teachers = {
        some: {
          teacherId: filters.teacherId,
        },
      };
    }

    const [classes, total] = await Promise.all([
      prisma.class.findMany({
        where,
        select: {
          id: true,
          name: true,
          description: true,
          teachers: {
            select: {
              teacher: {
                select: { id: true, name: true, avatar: true },
              },
            },
          },
          students: {
            select: { id: true, name: true, nis: true, avatar: true },
            orderBy: { name: 'asc' },
          },
          _count: {
            select: {
              students: true,
            },
          },
        },
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { name: 'asc' },
      }),
      prisma.class.count({ where }),
    ]);

    return { classes, total };
  }

  async findClassById(classId: string) {
    try {
      const classData = await prisma.class.findUnique({
        where: { id: classId },
        include: {
          students: {
            select: {
              id: true,
              name: true,
              email: true,
              nis: true,
              avatar: true,
            },
          },
          _count: {
            select: {
              students: true,
              assignments: true,
            },
          },
        },
      });

      if (!classData) {
        throw new Error(ErrorMessages.RESOURCE.CLASS_NOT_FOUND);
      }

      return classData;
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error(ErrorMessages.RESOURCE.CLASS_NOT_FOUND);
        }
      }
      throw error;
    }
  }

  async createClass(data: { name: string; description?: string }) {
    try {
      const classExists = await prisma.class.findUnique({
        where: { name: data.name },
      });
      
      if (classExists) {
        throw new Error(`Class name ${ErrorMessages.RESOURCE.ALREADY_EXISTS}`);
      }

      const classData = await prisma.class.create({
        data,
        include: {
          _count: {
            select: {
              students: true,
            },
          },
        },
      });

      return classData;
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          const target = (error.meta as any)?.target;
          const field = Array.isArray(target) ? target[0] : 'name';
          throw new Error(`${field} ${ErrorMessages.RESOURCE.ALREADY_EXISTS}`);
        }
        if (error.code === 'P2025') {
          throw new Error(ErrorMessages.RESOURCE.CLASS_NOT_FOUND);
        }
      }
      // Re-throw custom errors
      if (error.message?.includes(ErrorMessages.RESOURCE.ALREADY_EXISTS)) {
        throw error;
      }
      throw new Error('Failed to create class');
    }
  }

  async updateClass(classId: string, data: { name?: string; description?: string }) {
    try {
      const existingClass = await prisma.class.findUnique({
        where: { id: classId },
      });

      if (!existingClass) {
        throw new Error(ErrorMessages.RESOURCE.CLASS_NOT_FOUND);
      }

      if (data.name && data.name !== existingClass.name) {
        const classExists = await prisma.class.findUnique({
          where: { name: data.name },
        });
        if (classExists) {
          throw new Error(`Class name ${ErrorMessages.RESOURCE.ALREADY_EXISTS}`);
        }
      }

      const classData = await prisma.class.update({
        where: { id: classId },
        data,
        include: {
          _count: {
            select: {
              students: true,
            },
          },
        },
      });

      return classData;
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error(ErrorMessages.RESOURCE.CLASS_NOT_FOUND);
        }
        if (error.code === 'P2002') {
          const target = (error.meta as any)?.target;
          const field = Array.isArray(target) ? target[0] : 'name';
          throw new Error(`${field} ${ErrorMessages.RESOURCE.ALREADY_EXISTS}`);
        }
      }
      if (
        error.message === ErrorMessages.RESOURCE.CLASS_NOT_FOUND ||
        error.message?.includes(ErrorMessages.RESOURCE.ALREADY_EXISTS)
      ) {
        throw error;
      }
      throw new Error('Failed to update class');
    }
  }

  async deleteClass(classId: string) {
    try {
      const classData = await prisma.class.findUnique({
        where: { id: classId },
      });

      if (!classData) {
        throw new Error(ErrorMessages.RESOURCE.CLASS_NOT_FOUND);
      }

      await prisma.class.delete({
        where: { id: classId },
      });
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error(ErrorMessages.RESOURCE.CLASS_NOT_FOUND);
        }
        if (error.code === 'P2003') {
          throw new Error('Cannot delete class: Class has students or assignments');
        }
      }
      if (error.message === ErrorMessages.RESOURCE.CLASS_NOT_FOUND) {
        throw error;
      }
      throw error;
    }
  }
}

export default new ClassService();

