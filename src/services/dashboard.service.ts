import prisma from '../config/database';
import { UserRole } from '@prisma/client';
import { ErrorMessages } from '../constants/error-messages';

export class DashboardService {
  async getTeacherDashboard(teacherId: string) {
    const teacherClasses = await prisma.teacherClass.findMany({
      where: {
        teacherId,
      },
      select: {
        classId: true,
      },
    });
    const teacherClassIds = teacherClasses.map((tc) => tc.classId);

    const totalStudents =
      teacherClassIds.length > 0
        ? await prisma.user.count({
            where: {
              role: 'STUDENT',
              isActive: true,
              classId: {
                in: teacherClassIds,
              },
            },
          })
        : 0;

    const totalClasses = teacherClassIds.length;
    const activeAssignments = await prisma.assignment.count({
      where: {
        status: 'ACTIVE',
        createdById: teacherId,
        },
      });

    const teacherAssignmentIds = await prisma.assignment.findMany({
      where: {
        createdById: teacherId,
      },
      select: {
        id: true,
      },
    });
    const assignmentIds = teacherAssignmentIds.map((a) => a.id);

    const pendingSubmissions =
      assignmentIds.length > 0
        ? await prisma.submission.count({
            where: {
              status: 'PENDING',
              assignmentId: {
                in: assignmentIds,
              },
            },
          })
        : 0;

    const gradedSubmissions =
      assignmentIds.length > 0
        ? await prisma.submission.count({
            where: {
              status: 'GRADED',
              assignmentId: {
                in: assignmentIds,
              },
            },
          })
        : 0;

    const avgScoreResult =
      assignmentIds.length > 0
        ? await prisma.submission.aggregate({
            where: {
              status: 'GRADED',
              grade: { not: null },
              assignmentId: {
                in: assignmentIds,
              },
            },
            _avg: {
              grade: true,
            },
          })
        : { _avg: { grade: null } };
    const averageScore = avgScoreResult._avg.grade || 0;

    const recentSubmissions =
      assignmentIds.length > 0
        ? await prisma.submission.findMany({
            where: {
              status: { in: ['PENDING', 'GRADED'] },
              assignmentId: {
                in: assignmentIds,
              },
            },
            select: {
              id: true,
              grade: true,
              status: true,
              submittedAt: true,
              student: {
                select: {
                  id: true,
                  name: true,
                  nis: true,
                },
              },
              assignment: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
            orderBy: { submittedAt: 'desc' },
            take: 5,
          })
        : [];

    const topStudents =
      teacherClassIds.length > 0 && assignmentIds.length > 0
        ? await prisma.user.findMany({
            where: {
              role: 'STUDENT',
              isActive: true,
              classId: {
                in: teacherClassIds,
              },
            },
            select: {
              id: true,
              name: true,
              nis: true,
              className: true,
              submissions: {
                where: {
                  status: 'GRADED',
                  grade: { not: null },
                  assignmentId: {
                    in: assignmentIds,
                  },
                },
                select: {
                  grade: true,
                },
              },
            },
            take: 20,
          })
        : [];

    const topStudentsWithScore = topStudents
      .map((student) => {
        const grades = student.submissions.map((s) => s.grade!).filter((g) => g !== null);
        const avgScore = grades.length > 0 ? grades.reduce((a, b) => a + b, 0) / grades.length : 0;
        return {
          id: student.id,
          name: student.name,
          nis: student.nis,
          className: student.className,
          avgScore: Math.round(avgScore * 10) / 10,
          portfolioCount: grades.length,
        };
      })
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 5);

    const upcomingDeadlines = await prisma.assignment.findMany({
      where: {
        status: 'ACTIVE',
        deadline: { gte: new Date() },
        createdById: teacherId,
      },
      include: {
        _count: {
          select: {
            submissions: true,
          },
        },
        classes: {
          include: {
            class: {
              include: {
                _count: {
                  select: {
                    students: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { deadline: 'asc' },
      take: 5,
    });

    const upcomingDeadlinesWithCount = upcomingDeadlines.map((assignment) => {
      const totalStudents = assignment.classes.reduce(
        (sum, ac) => sum + (ac.class._count.students || 0),
        0
      );
      return {
        id: assignment.id,
        title: assignment.title,
        deadline: assignment.deadline,
        submissionCount: assignment._count.submissions,
        totalStudents,
      };
    });

    return {
      role: 'TEACHER' as UserRole,
      statistics: {
        totalStudents,
        totalClasses,
        activeAssignments,
        pendingSubmissions,
        gradedSubmissions,
        averageScore: Math.round(averageScore * 10) / 10,
      },
      recentSubmissions: recentSubmissions.map((s) => ({
        id: s.id,
        studentName: s.student.name,
        studentNis: s.student.nis,
        assignmentTitle: s.assignment.title,
        grade: s.grade,
        status: s.status,
        submittedAt: s.submittedAt,
      })),
      topStudents: topStudentsWithScore,
      upcomingDeadlines: upcomingDeadlinesWithCount,
    };
  }

  async getStudentDashboard(studentId: string) {
    const portfolioCount = await prisma.submission.count({
      where: {
        studentId,
        status: 'GRADED',
      },
    });

    const completedAssignments = await prisma.submission.count({
      where: {
        studentId,
        status: 'GRADED',
      },
    });

    const student = await prisma.user.findUnique({
      where: { id: studentId },
      select: {
        classId: true,
      },
    });

    if (!student || !student.classId) {
      throw new Error(ErrorMessages.RESOURCE.USER_NOT_FOUND);
    }

    const totalAssignments = await prisma.assignment.count({
      where: {
        status: 'ACTIVE',
        classes: {
          some: {
            classId: student.classId,
          },
        },
      },
    });

    const pendingAssignments = await prisma.assignment.findMany({
      where: {
        status: 'ACTIVE',
        classes: {
          some: {
            classId: student.classId,
          },
        },
        deadline: { gte: new Date() },
      },
      select: {
        id: true,
        title: true,
        description: true,
        deadline: true,
        mediaType: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        submissions: {
          where: {
            studentId,
          },
          select: {
            id: true,
            status: true,
          },
          take: 1,
        },
      },
      orderBy: { deadline: 'asc' },
      take: 5,
    });

    const pendingAssignmentsWithProgress = pendingAssignments.map((assignment) => {
      const submission = assignment.submissions[0];
      const daysRemaining = Math.ceil(
        (new Date(assignment.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        id: assignment.id,
        title: assignment.title,
        description: assignment.description,
        deadline: assignment.deadline,
        mediaType: assignment.mediaType,
        daysRemaining: daysRemaining > 0 ? daysRemaining : 0,
        mySubmission: submission
          ? {
              id: submission.id,
              status: submission.status,
            }
          : null,
      };
    });

    // Get average score
    const avgScoreResult = await prisma.submission.aggregate({
      where: {
        studentId,
        status: 'GRADED',
        grade: { not: null },
      },
      _avg: {
        grade: true,
      },
    });
    const averageScore = avgScoreResult._avg.grade || 0;

    const highestScoreResult = await prisma.submission.findFirst({
      where: {
        studentId,
        status: 'GRADED',
        grade: { not: null },
      },
      orderBy: { grade: 'desc' },
      select: {
        grade: true,
      },
    });
    const highestScore = highestScoreResult?.grade || 0;

    const totalSubmissions = await prisma.submission.count({
      where: {
        studentId,
      },
    });

    const recentWorks = await prisma.submission.findMany({
      where: {
        studentId,
        status: 'GRADED',
      },
      select: {
        id: true,
        title: true,
        grade: true,
        status: true,
        submittedAt: true,
        imageUrl: true,
        imageThumbnail: true,
        imageMedium: true,
        assignment: {
          select: {
            mediaType: {
              select: {
                id: true,
                name: true,
                description: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
      take: 5,
    });

    const recentWorksFormatted = recentWorks.map((work) => ({
      id: work.id,
      title: work.title,
      mediaType: work.assignment?.mediaType || undefined,
      grade: work.grade,
      status: work.status,
      submittedAt: work.submittedAt,
      imageUrl: work.imageUrl,
      imageThumbnail: work.imageThumbnail,
      imageMedium: work.imageMedium,
    }));

    // Get achievements (placeholder - will be implemented later)
    const achievements = await prisma.userAchievement.findMany({
      where: {
        userId: studentId,
      },
      select: {
        id: true,
        unlockedAt: true,
        achievement: {
          select: {
            id: true,
            name: true,
            description: true,
            icon: true,
          },
        },
      },
      orderBy: { unlockedAt: 'desc' },
      take: 5,
    });

    const achievementsFormatted = achievements.map((ua) => ({
      id: ua.achievement.id,
      name: ua.achievement.name,
      description: ua.achievement.description,
      icon: ua.achievement.icon,
      unlockedAt: ua.unlockedAt,
    }));

    return {
      role: 'STUDENT' as UserRole,
      statistics: {
        portfolioCount,
        completedAssignments,
        totalAssignments,
        pendingAssignments: pendingAssignments.length,
        averageScore: Math.round(averageScore * 10) / 10,
        highestScore,
        totalSubmissions,
      },
      recentWorks: recentWorksFormatted,
      pendingAssignments: pendingAssignmentsWithProgress,
      achievements: achievementsFormatted,
    };
  }
}

export default new DashboardService();

