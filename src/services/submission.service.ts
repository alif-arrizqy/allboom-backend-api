import prisma from '../config/database';
import { SubmissionStatus, Prisma, NotificationType } from '@prisma/client';
import { PaginationResult } from '../utils/pagination';
import { ErrorMessages } from '../constants/error-messages';
import notificationService from './notification.service';
import achievementCheckerService from './achievement-checker.service';

export interface SubmissionFilters {
  assignmentId?: string;
  studentId?: string;
  status?: SubmissionStatus;
  search?: string;
}

export class SubmissionService {
  async findSubmissions(filters: SubmissionFilters, pagination: PaginationResult) {
    const where: any = {};

    if (filters.assignmentId) {
      where.assignmentId = filters.assignmentId;
    }

    if (filters.studentId) {
      where.studentId = filters.studentId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [submissions, total] = await Promise.all([
      prisma.submission.findMany({
        where,
        include: {
          assignment: {
            select: {
              id: true,
              title: true,
              mediaType: {
                select: {
                  id: true,
                  name: true,
                },
              },
              deadline: true,
            },
          },
          student: {
            select: {
              id: true,
              name: true,
              nis: true,
              email: true,
              avatar: true,
              className: true,
              classId: true,
            },
          },
          revisions: {
            orderBy: { version: 'asc' },
          },
        },
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { submittedAt: 'desc' },
      }),
      prisma.submission.count({ where }),
    ]);

    const submissionsWithHistory = submissions.map((submission) => {
      const revisionVersions = submission.revisions.map((rev) => rev.version);
      const maxRevisionVersion = revisionVersions.length > 0 ? Math.max(...revisionVersions) : 0;
      const currentVersion = maxRevisionVersion + 1;

      const imageHistory = submission.revisions.map((rev) => ({
        image: rev.imageUrl,
        submittedAt: rev.submittedAt.toISOString(),
        version: rev.version,
      }));

      const latestRevision =
        maxRevisionVersion > 0
          ? submission.revisions.find((rev) => rev.version === maxRevisionVersion)
          : null;
      const currentImageInRevisions =
        latestRevision && latestRevision.imageUrl === submission.imageUrl;

      if (!currentImageInRevisions) {
        imageHistory.push({
          image: submission.imageUrl,
          submittedAt: (submission.submittedAt || submission.createdAt).toISOString(),
          version: currentVersion,
        });
      }

      imageHistory.sort((a, b) => a.version - b.version);

      return {
        ...submission,
        imageHistory,
      };
    });

    return { submissions: submissionsWithHistory, total };
  }

  async findSubmissionById(submissionId: string) {
    try {
      const submission = await prisma.submission.findUnique({
        where: { id: submissionId },
        include: {
          assignment: {
            include: {
              createdBy: {
                select: {
                  id: true,
                  name: true,
                },
              },
              mediaType: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          student: {
            select: {
              id: true,
              name: true,
              nis: true,
              email: true,
              avatar: true,
              className: true,
            },
          },
          revisions: {
            orderBy: { version: 'asc' },
          },
        },
      });

      if (!submission) {
        throw new Error(ErrorMessages.RESOURCE.SUBMISSION_NOT_FOUND);
      }

      const revisionVersions = submission.revisions.map((rev) => rev.version);
      const maxRevisionVersion = revisionVersions.length > 0 ? Math.max(...revisionVersions) : 0;
      const currentVersion = maxRevisionVersion + 1;

      const imageHistory = submission.revisions.map((rev) => ({
        image: rev.imageUrl,
        submittedAt: rev.submittedAt.toISOString(),
        version: rev.version,
      }));

      const latestRevision =
        maxRevisionVersion > 0
          ? submission.revisions.find((rev) => rev.version === maxRevisionVersion)
          : null;
      const currentImageInRevisions =
        latestRevision && latestRevision.imageUrl === submission.imageUrl;

      if (!currentImageInRevisions) {
        imageHistory.push({
          image: submission.imageUrl,
          submittedAt: (submission.submittedAt || submission.createdAt).toISOString(),
          version: currentVersion,
        });
      }

      imageHistory.sort((a, b) => a.version - b.version);

      return {
        ...submission,
        imageHistory,
      };
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error(ErrorMessages.RESOURCE.SUBMISSION_NOT_FOUND);
        }
      }
      throw error;
    }
  }

  async createSubmission(data: {
    assignmentId: string;
    studentId: string;
    title: string;
    description?: string;
    imageUrl: string;
    imageThumbnail?: string;
    imageMedium?: string;
    mediaTypeId?: string;
    artworkSize?: string;
    yearCreated?: number;
  }) {
    try {
      const assignment = await prisma.assignment.findUnique({
        where: { id: data.assignmentId },
      });

      if (!assignment) {
        throw new Error(ErrorMessages.RESOURCE.ASSIGNMENT_NOT_FOUND);
      }

      if (assignment.status !== 'ACTIVE') {
        throw new Error('Tugas ini sudah ditutup dan tidak menerima pengumpulan baru');
      }

      if (assignment.deadline < new Date()) {
        throw new Error('Assignment deadline has passed');
      }

      const existingSubmission = await prisma.submission.findUnique({
        where: {
          assignmentId_studentId: {
            assignmentId: data.assignmentId,
            studentId: data.studentId,
          },
        },
        include: {
          revisions: {
            orderBy: { version: 'asc' },
          },
        },
      });

      if (existingSubmission) {
        if (
          existingSubmission.status !== SubmissionStatus.PENDING &&
          existingSubmission.status !== SubmissionStatus.REVISION
        ) {
          throw new Error('Cannot update submission: Already graded');
        }

        const updatedSubmission = await this.updateSubmission(existingSubmission.id, {
          title: data.title,
          description: data.description,
          imageUrl: data.imageUrl,
          imageThumbnail: data.imageThumbnail,
          imageMedium: data.imageMedium,
        });

        return {
          ...updatedSubmission,
          _isUpdate: true,
          _wasRevision: existingSubmission.status === SubmissionStatus.REVISION,
        };
      }

      const submission = await prisma.submission.create({
        data: {
          assignmentId: data.assignmentId,
          studentId: data.studentId,
          title: data.title,
          description: data.description,
          imageUrl: data.imageUrl,
          imageThumbnail: data.imageThumbnail,
          imageMedium: data.imageMedium,
          mediaTypeId: data.mediaTypeId,
          artworkSize: data.artworkSize,
          yearCreated: data.yearCreated,
          status: SubmissionStatus.PENDING,
          submittedAt: new Date(),
        },
        include: {
          assignment: {
            select: {
              id: true,
              title: true,
              mediaType: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          student: {
            select: {
              id: true,
              name: true,
              nis: true,
              avatar: true,
            },
          },
          revisions: {
            orderBy: { version: 'asc' },
          },
        },
      });

      const imageHistory = [
        {
          image: submission.imageUrl,
          submittedAt: (submission.submittedAt || submission.createdAt).toISOString(),
          version: 1,
        },
      ];

      return {
        ...submission,
        imageHistory,
      };
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2003') {
          throw new Error(ErrorMessages.RESOURCE.ASSIGNMENT_NOT_FOUND);
        }
      }
      throw error;
    }
  }

  async updateSubmission(
    submissionId: string,
    data: {
      title?: string;
      description?: string;
      imageUrl?: string;
      imageThumbnail?: string;
      imageMedium?: string;
      mediaTypeId?: string;
      artworkSize?: string;
      yearCreated?: number;
    }
  ) {
    try {
      const existingSubmission = await prisma.submission.findUnique({
        where: { id: submissionId },
      });

      if (!existingSubmission) {
        throw new Error(ErrorMessages.RESOURCE.SUBMISSION_NOT_FOUND);
      }

      if (
        existingSubmission.status !== SubmissionStatus.PENDING &&
        existingSubmission.status !== SubmissionStatus.REVISION
      ) {
        throw new Error('Cannot update submission: Already graded');
      }

      if (data.imageUrl && data.imageUrl !== existingSubmission.imageUrl) {
        const existingRevisions = await prisma.submissionRevision.findMany({
          where: { submissionId: submissionId },
          select: { version: true, imageUrl: true },
        });

        const maxVersion =
          existingRevisions.length > 0 ? Math.max(...existingRevisions.map((r) => r.version)) : 0;
        const currentImageVersion = maxVersion + 1;

        const imageAlreadyInRevisions = existingRevisions.some(
          (r) => r.imageUrl === existingSubmission.imageUrl
        );

        if (!imageAlreadyInRevisions) {
          await prisma.submissionRevision.create({
            data: {
              submissionId: submissionId,
              revisionNote: null,
              imageUrl: existingSubmission.imageUrl,
              version: currentImageVersion,
              submittedAt: new Date(),
            },
          });
        }
      }

      const updatePayload: any = { ...data };
      if (existingSubmission.status === SubmissionStatus.REVISION) {
        updatePayload.status = SubmissionStatus.PENDING;
        updatePayload.submittedAt = new Date();
      }

      const submission = await prisma.submission.update({
        where: { id: submissionId },
        data: updatePayload,
        include: {
          assignment: {
            select: {
              id: true,
              title: true,
              mediaType: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          student: {
            select: {
              id: true,
              name: true,
              nis: true,
              avatar: true,
            },
          },
          revisions: {
            orderBy: { version: 'asc' },
          },
        },
      });

      const revisionVersions = submission.revisions.map((rev) => rev.version);
      const maxRevisionVersion = revisionVersions.length > 0 ? Math.max(...revisionVersions) : 0;
      const currentVersion = maxRevisionVersion + 1;

      const imageHistory = submission.revisions.map((rev) => ({
        image: rev.imageUrl,
        submittedAt: rev.submittedAt.toISOString(),
        version: rev.version,
      }));

      const latestRevision =
        maxRevisionVersion > 0
          ? submission.revisions.find((rev) => rev.version === maxRevisionVersion)
          : null;
      const currentImageInRevisions =
        latestRevision && latestRevision.imageUrl === submission.imageUrl;

      if (!currentImageInRevisions) {
        imageHistory.push({
          image: submission.imageUrl,
          submittedAt: (submission.submittedAt || submission.createdAt).toISOString(),
          version: currentVersion,
        });
      }

      imageHistory.sort((a, b) => a.version - b.version);

      return {
        ...submission,
        imageHistory,
      };
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error(ErrorMessages.RESOURCE.SUBMISSION_NOT_FOUND);
        }
      }
      throw error;
    }
  }

  async gradeSubmission(submissionId: string, grade: number, feedback?: string) {
    try {
      const existingSubmission = await prisma.submission.findUnique({
        where: { id: submissionId },
      });

      if (!existingSubmission) {
        throw new Error(ErrorMessages.RESOURCE.SUBMISSION_NOT_FOUND);
      }

      const submission = await prisma.submission.update({
        where: { id: submissionId },
        data: {
          grade,
          feedback,
          status: SubmissionStatus.GRADED,
          gradedAt: new Date(),
        },
        include: {
          assignment: {
            select: {
              id: true,
              title: true,
            },
          },
          student: {
            select: {
              id: true,
              name: true,
              email: true,
              nis: true,
            },
          },
          revisions: {
            orderBy: { version: 'asc' },
          },
        },
      });

      const gradeLetter =
        grade >= 90 ? 'A' : grade >= 80 ? 'B' : grade >= 70 ? 'C' : grade >= 60 ? 'D' : 'E';
      await notificationService.createNotification({
        userId: submission.student.id,
        type: NotificationType.SUBMISSION_GRADED,
        title: 'Karya Dinilai',
        message: `Karya '${submission.title}' telah dinilai dengan nilai ${gradeLetter} (${grade})`,
        link: `/assignments`,
      });

      achievementCheckerService.checkAndUnlockAchievements(submission.student.id).catch((error) => {
        console.error('Error checking achievements:', error);
      });

      const revisionVersions = submission.revisions.map((rev) => rev.version);
      const maxRevisionVersion = revisionVersions.length > 0 ? Math.max(...revisionVersions) : 0;
      const currentVersion = maxRevisionVersion + 1;

      const imageHistory = submission.revisions.map((rev) => ({
        image: rev.imageUrl,
        submittedAt: rev.submittedAt.toISOString(),
        version: rev.version,
      }));

      const latestRevision =
        maxRevisionVersion > 0
          ? submission.revisions.find((rev) => rev.version === maxRevisionVersion)
          : null;
      const currentImageInRevisions =
        latestRevision && latestRevision.imageUrl === submission.imageUrl;

      if (!currentImageInRevisions) {
        imageHistory.push({
          image: submission.imageUrl,
          submittedAt: (submission.submittedAt || submission.createdAt).toISOString(),
          version: currentVersion,
        });
      }

      imageHistory.sort((a, b) => a.version - b.version);

      return {
        ...submission,
        imageHistory,
      };
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error(ErrorMessages.RESOURCE.SUBMISSION_NOT_FOUND);
        }
      }
      throw error;
    }
  }

  async returnForRevision(submissionId: string, revisionNote: string, _imageUrl: string) {
    try {
      const existingSubmission = await prisma.submission.findUnique({
        where: { id: submissionId },
      });

      if (!existingSubmission) {
        throw new Error(ErrorMessages.RESOURCE.SUBMISSION_NOT_FOUND);
      }

      const existingRevisions = await prisma.submissionRevision.findMany({
        where: { submissionId },
        select: { version: true },
      });
      const maxVersion =
        existingRevisions.length > 0 ? Math.max(...existingRevisions.map((r) => r.version)) : 0;
      const currentImageVersion = maxVersion + 1;

      const versionExists = existingRevisions.some((r) => r.version === currentImageVersion);
      if (!versionExists) {
        await prisma.submissionRevision.create({
          data: {
            submissionId,
            revisionNote,
            imageUrl: existingSubmission.imageUrl,
            version: currentImageVersion,
            submittedAt: new Date(),
          },
        });
      }

      const submission = await prisma.submission.update({
        where: { id: submissionId },
        data: {
          status: SubmissionStatus.REVISION,
          revisionCount: {
            increment: 1,
          },
        },
        include: {
          assignment: {
            select: {
              id: true,
              title: true,
            },
          },
          student: {
            select: {
              id: true,
              name: true,
              email: true,
              nis: true,
            },
          },
          revisions: {
            orderBy: { version: 'asc' },
          },
        },
      });

      await notificationService.createNotification({
        userId: submission.student.id,
        type: NotificationType.SUBMISSION_REVISION,
        title: 'Karya Perlu Direvisi',
        message: `Karya '${submission.title}' perlu direvisi. ${revisionNote.substring(0, 100)}${revisionNote.length > 100 ? '...' : ''}`,
        link: `/assignments`,
      });

      const revisionVersions = submission.revisions.map((rev) => rev.version);
      const maxRevisionVersion = revisionVersions.length > 0 ? Math.max(...revisionVersions) : 0;
      const currentVersion = maxRevisionVersion + 1;

      const imageHistory = submission.revisions.map((rev) => ({
        image: rev.imageUrl,
        submittedAt: rev.submittedAt.toISOString(),
        version: rev.version,
      }));

      const latestRevision =
        maxRevisionVersion > 0
          ? submission.revisions.find((rev) => rev.version === maxRevisionVersion)
          : null;
      const currentImageInRevisions =
        latestRevision && latestRevision.imageUrl === submission.imageUrl;

      if (!currentImageInRevisions) {
        imageHistory.push({
          image: submission.imageUrl,
          submittedAt: (submission.submittedAt || submission.createdAt).toISOString(),
          version: currentVersion,
        });
      }

      imageHistory.sort((a, b) => a.version - b.version);

      return {
        ...submission,
        imageHistory,
      };
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error(ErrorMessages.RESOURCE.SUBMISSION_NOT_FOUND);
        }
      }
      throw error;
    }
  }

  async deleteSubmission(submissionId: string) {
    try {
      const submission = await prisma.submission.findUnique({
        where: { id: submissionId },
      });

      if (!submission) {
        throw new Error(ErrorMessages.RESOURCE.SUBMISSION_NOT_FOUND);
      }

      if (submission.status !== SubmissionStatus.PENDING) {
        throw new Error('Cannot delete submission: Already graded or in revision');
      }

      await prisma.submission.delete({
        where: { id: submissionId },
      });
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error(ErrorMessages.RESOURCE.SUBMISSION_NOT_FOUND);
        }
      }
      throw error;
    }
  }
}

export default new SubmissionService();
