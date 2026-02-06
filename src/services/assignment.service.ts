import prisma from '../config/database';
import { AssignmentStatus, Prisma, NotificationType } from '@prisma/client';
import { PaginationResult } from '../utils/pagination';
import { ErrorMessages } from '../constants/error-messages';
import notificationService from './notification.service';

export interface AssignmentFilters {
  status?: AssignmentStatus;
  mediaTypeId?: string;
  classId?: string;
  search?: string;
  createdById?: string;
  userId?: string;
  userRole?: string;
}

export class AssignmentService {
  async findAssignments(filters: AssignmentFilters, pagination: PaginationResult) {
    const where: any = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.mediaTypeId) {
      where.mediaTypeId = filters.mediaTypeId;
    }

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.userRole === 'STUDENT' && filters.userId) {
      const student = await prisma.user.findUnique({
        where: { id: filters.userId },
        select: {
          classId: true,
        },
      });

      if (!student || !student.classId) {
        return { assignments: [], total: 0 };
      }

      where.classes = {
        some: {
          classId: student.classId,
        },
      };
    } else if (filters.userRole === 'TEACHER' && filters.userId) {
      const teacherClasses = await prisma.teacherClass.findMany({
        where: {
          teacherId: filters.userId,
        },
        select: {
          classId: true,
        },
      });
      const teacherClassIds = teacherClasses.map((tc) => tc.classId);

      if (teacherClassIds.length === 0) {
        return { assignments: [], total: 0 };
      }

      where.createdById = filters.userId;

      if (filters.classId) {
        if (!teacherClassIds.includes(filters.classId)) {
          return { assignments: [], total: 0 };
        }
        where.classes = {
          some: {
            classId: filters.classId,
          },
        };
      } else {
        where.classes = {
          some: {
            classId: {
              in: teacherClassIds,
            },
          },
        };
      }
    } else {
      if (filters.createdById) {
        where.createdById = filters.createdById;
      }

      if (filters.classId) {
        where.classes = {
          some: {
            classId: filters.classId,
          },
        };
      }
    }

    const [assignments, total] = await Promise.all([
      prisma.assignment.findMany({
        where,
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          mediaType: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
          classes: {
            include: {
              class: {
                select: {
                  id: true,
                  name: true,
                  _count: {
                    select: {
                      students: true,
                    },
                  },
                },
              },
            },
          },
          _count: {
            select: {
              submissions: true,
            },
          },
        },
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.assignment.count({ where }),
    ]);

    return { assignments, total };
  }

  async findAssignmentById(assignmentId: string) {
    try {
      const assignment = await prisma.assignment.findUnique({
        where: { id: assignmentId },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          mediaType: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
          classes: {
            include: {
              class: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          submissions: {
            include: {
              student: {
                select: {
                  id: true,
                  name: true,
                  nis: true,
                  avatar: true,
                },
              },
            },
          },
        },
      });

      if (!assignment) {
        throw new Error(ErrorMessages.RESOURCE.ASSIGNMENT_NOT_FOUND);
      }

      return assignment;
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error(ErrorMessages.RESOURCE.ASSIGNMENT_NOT_FOUND);
        }
      }
      throw error;
    }
  }

  async createAssignment(
    data: {
      title: string;
      description: string;
      mediaTypeId: string;
      artworkSize?: string;
      deadline: Date;
      status: AssignmentStatus;
      createdById: string;
      classIds: string[];
    }
  ) {
    try {
      const mediaType = await prisma.mediaType.findUnique({
        where: { id: data.mediaTypeId },
      });

      if (!mediaType) {
        throw new Error(ErrorMessages.RESOURCE.NOT_FOUND);
      }

      const classes = await prisma.class.findMany({
        where: { id: { in: data.classIds } },
      });

      if (classes.length !== data.classIds.length) {
        throw new Error(ErrorMessages.RESOURCE.CLASS_NOT_FOUND);
      }

      const assignment = await prisma.assignment.create({
        data: {
          title: data.title,
          description: data.description,
          mediaTypeId: data.mediaTypeId,
          artworkSize: data.artworkSize,
          deadline: data.deadline,
          status: data.status,
          createdById: data.createdById,
          classes: {
            create: data.classIds.map((classId) => ({
              classId,
            })),
          },
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          mediaType: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
          classes: {
            include: {
              class: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
    });

    if (data.status === AssignmentStatus.ACTIVE) {
      const students = await prisma.user.findMany({
        where: {
          role: 'STUDENT',
          classId: {
            in: data.classIds,
          },
        },
        select: {
          id: true,
        },
      });

      const notificationPromises = students.map((student) =>
        notificationService.createNotification({
          userId: student.id,
          type: NotificationType.ASSIGNMENT_CREATED,
          title: 'Tugas Baru',
          message: `Tugas baru '${data.title}' telah dibuat. Deadline: ${new Date(data.deadline).toLocaleDateString('id-ID')}`,
          link: `/assignments`,
        })
      );

      Promise.all(notificationPromises).catch((error) => {
        console.error('Error creating assignment notifications:', error);
      });
    }

    return assignment;
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2003') {
          throw new Error(ErrorMessages.RESOURCE.CLASS_NOT_FOUND);
        }
        if (error.code === 'P2002') {
          const target = (error.meta as any)?.target;
          const field = Array.isArray(target) ? target[0] : 'field';
          throw new Error(`${field} ${ErrorMessages.RESOURCE.ALREADY_EXISTS}`);
        }
      }
      throw error;
    }
  }

  async updateAssignment(
    assignmentId: string,
    data: {
      title?: string;
      description?: string;
      mediaTypeId?: string;
      artworkSize?: string;
      deadline?: Date;
      status?: AssignmentStatus;
      classIds?: string[];
    }
  ) {
    try {
      const existingAssignment = await prisma.assignment.findUnique({
        where: { id: assignmentId },
      });

      if (!existingAssignment) {
        throw new Error(ErrorMessages.RESOURCE.ASSIGNMENT_NOT_FOUND);
      }

      if (data.mediaTypeId) {
        const mediaType = await prisma.mediaType.findUnique({
          where: { id: data.mediaTypeId },
        });

        if (!mediaType) {
          throw new Error(ErrorMessages.RESOURCE.NOT_FOUND);
        }
      }

      if (data.classIds) {
        await prisma.assignmentClass.deleteMany({
          where: { assignmentId },
        });

        await prisma.assignmentClass.createMany({
          data: data.classIds.map((classId) => ({
            assignmentId,
            classId,
          })),
        });
      }

      const { classIds, ...updateData } = data;

      const assignment = await prisma.assignment.update({
        where: { id: assignmentId },
        data: updateData,
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          mediaType: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
          classes: {
            include: {
              class: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      return assignment;
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error(ErrorMessages.RESOURCE.ASSIGNMENT_NOT_FOUND);
        }
      }
      throw error;
    }
  }

  async deleteAssignment(assignmentId: string) {
    try {
      const assignment = await prisma.assignment.findUnique({
        where: { id: assignmentId },
      });

      if (!assignment) {
        throw new Error(ErrorMessages.RESOURCE.ASSIGNMENT_NOT_FOUND);
      }

      await prisma.assignment.delete({
        where: { id: assignmentId },
      });
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error(ErrorMessages.RESOURCE.ASSIGNMENT_NOT_FOUND);
        }
      }
      throw error;
    }
  }

  async bulkUpdateStatus(assignmentIds: string[], status: AssignmentStatus) {
    await prisma.assignment.updateMany({
      where: {
        id: {
          in: assignmentIds,
        },
      },
      data: {
        status,
      },
    });
  }

  async bulkDelete(assignmentIds: string[]) {
    await prisma.assignment.deleteMany({
      where: {
        id: {
          in: assignmentIds,
        },
      },
    });
  }
}

export default new AssignmentService();

