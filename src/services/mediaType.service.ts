import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { PaginationResult } from '../utils/pagination';
import { ErrorMessages } from '../constants/error-messages';

export interface MediaTypeFilters {
  search?: string;
  isActive?: boolean;
}

export class MediaTypeService {
  async findMediaTypes(filters: MediaTypeFilters, pagination: PaginationResult) {
    const where: Prisma.MediaTypeWhereInput = {} as any;

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    const [mediaTypes, total] = await Promise.all([
      prisma.mediaType.findMany({
        where,
        select: {
          id: true,
          name: true,
          description: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              assignments: true,
            },
          },
        },
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { name: 'asc' },
      }),
      prisma.mediaType.count({ where }),
    ]);

    const withCount = mediaTypes.map((m) => ({
      ...m,
      assignmentCount: (m as any)._count?.assignments || 0,
      _count: undefined,
    }));

    return { mediaTypes: withCount, total };
  }

  async findMediaTypeById(id: string) {
    try {
      const mediaType = await prisma.mediaType.findUnique({
        where: { id },
        include: { _count: { select: { assignments: true } } },
      });

      if (!mediaType) throw new Error(ErrorMessages.RESOURCE.NOT_FOUND);

      return { ...mediaType, assignmentCount: (mediaType as any)._count.assignments, _count: undefined };
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new Error(ErrorMessages.RESOURCE.NOT_FOUND);
      }
      throw error;
    }
  }

  async createMediaType(data: { name: string; description?: string }) {
    try {
      const exists = await prisma.mediaType.findUnique({ where: { name: data.name } });
      if (exists) throw new Error(`${data.name} ${ErrorMessages.RESOURCE.ALREADY_EXISTS}`);

      const mediaType = await prisma.mediaType.create({
        data: { name: data.name.trim(), description: data.description?.trim(), isActive: true },
      });

      return mediaType;
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') throw new Error(`${data.name} ${ErrorMessages.RESOURCE.ALREADY_EXISTS}`);
      }
      throw error;
    }
  }

  async updateMediaType(id: string, data: { name?: string; description?: string; isActive?: boolean }) {
    try {
      const existing = await prisma.mediaType.findUnique({ where: { id } });
      if (!existing) throw new Error(ErrorMessages.RESOURCE.NOT_FOUND);

      if (data.name && data.name !== existing.name) {
        const exists = await prisma.mediaType.findUnique({ where: { name: data.name } });
        if (exists) throw new Error(`${data.name} ${ErrorMessages.RESOURCE.ALREADY_EXISTS}`);
      }

      const updated = await prisma.mediaType.update({ where: { id }, data });
      return updated;
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new Error(ErrorMessages.RESOURCE.NOT_FOUND);
      }
      throw error;
    }
  }

  async deleteMediaType(id: string, force: boolean = false) {
    try {
      const mediaType = await prisma.mediaType.findUnique({ where: { id }, include: { _count: { select: { assignments: true } } } });
      if (!mediaType) throw new Error(ErrorMessages.RESOURCE.NOT_FOUND);
      if ((mediaType as any)._count.assignments > 0 && !force) throw new Error('Cannot delete media type: Has assignments');
      await prisma.mediaType.delete({ where: { id } });
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new Error(ErrorMessages.RESOURCE.NOT_FOUND);
      }
      throw error;
    }
  }
}

export default new MediaTypeService();
