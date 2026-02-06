import prisma from '../config/database';
import achievementService from './achievement.service';
import notificationService from './notification.service';
import { NotificationType } from '@prisma/client';

export class AchievementCheckerService {
  async checkAndUnlockAchievements(userId: string) {
    try {
      const allAchievements = await prisma.achievement.findMany({
        include: {
          users: {
            where: { userId },
          },
        },
      });

      const unlockedAchievementIds = allAchievements
        .filter((a) => a.users.length > 0)
        .map((a) => a.id);

      const availableAchievements = await prisma.achievement.findMany({
        where: {
          id: {
            notIn: unlockedAchievementIds,
          },
        },
      });

      const userStats = await this.getUserStatistics(userId);
      const unlockedAchievements = [];
      for (const achievement of availableAchievements) {
        const shouldUnlock = this.checkCriteria(achievement.criteria as any, userStats);
        if (shouldUnlock) {
          try {
            const userAchievement = await achievementService.unlockAchievement(userId, achievement.id);
            unlockedAchievements.push(userAchievement);

            await notificationService.createNotification({
              userId,
              type: NotificationType.ACHIEVEMENT_UNLOCKED,
              title: 'Achievement Terbuka!',
              message: `Selamat! Anda mendapatkan achievement "${achievement.name}"`,
              link: `/achievements/${achievement.id}`,
            });
          } catch (error: any) {
            console.error(`Error unlocking achievement ${achievement.id}:`, error);
          }
        }
      }

      return unlockedAchievements;
    } catch (error: any) {
      console.error('Error checking achievements:', error);
      return [];
    }
  }

  private async getUserStatistics(userId: string) {
    const [submissions, assignments] = await Promise.all([
      prisma.submission.findMany({
        where: {
          studentId: userId,
          status: 'GRADED',
        },
        include: {
          assignment: {
            select: {
              mediaTypeId: true,
            },
          },
        },
      }),
      prisma.assignment.findMany({
        where: {
          classes: {
            some: {
              class: {
                students: {
                  some: {
                    id: userId,
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    const grades = submissions.map((s) => s.grade || 0).filter((g) => g > 0);
    const totalGraded = submissions.length;
    const averageGrade = grades.length > 0 ? grades.reduce((a, b) => a + b, 0) / grades.length : 0;
    const highestGrade = grades.length > 0 ? Math.max(...grades) : 0;
    const mediaTypeIds = submissions.map((s: any) => s.assignment?.mediaTypeId).filter((id: string | null | undefined) => id !== null && id !== undefined);
    const uniqueMediaTypes = [...new Set(mediaTypeIds)];

    return {
      totalGradedSubmissions: totalGraded,
      averageGrade,
      highestGrade,
      totalAssignments: assignments.length,
      completedMediaTypes: uniqueMediaTypes.length,
      mediaTypeIds: uniqueMediaTypes,
      gradeCount: {
        A: grades.filter((g) => g >= 90).length,
        B: grades.filter((g) => g >= 80 && g < 90).length,
        C: grades.filter((g) => g >= 70 && g < 80).length,
      },
    };
  }

  private checkCriteria(criteria: any, stats: any): boolean {
    if (!criteria || typeof criteria !== 'object') {
      return false;
    }

    const { type, value, operator = '>=' } = criteria;

    switch (type) {
      case 'total_graded_submissions':
        return this.compare(stats.totalGradedSubmissions, value, operator);

      case 'average_grade':
        return this.compare(stats.averageGrade, value, operator);

      case 'highest_grade':
        return this.compare(stats.highestGrade, value, operator);

      case 'grade_count':
        const gradeCount = stats.gradeCount.A || 0;
        return this.compare(gradeCount, value, operator);

      case 'category_completion':
        const requiredMediaTypes = criteria.categories || [];
        const completedMediaTypes = stats.mediaTypeIds || [];
        if (criteria.operator === 'all') {
          return requiredMediaTypes.every((mt: string) => completedMediaTypes.includes(mt));
        }
        return completedMediaTypes.length >= value;

      default:
        return false;
    }
  }

  private compare(actual: number, target: number, operator: string): boolean {
    switch (operator) {
      case '>=':
        return actual >= target;
      case '<=':
        return actual <= target;
      case '>':
        return actual > target;
      case '<':
        return actual < target;
      case '==':
      case '===':
        return actual === target;
      default:
        return false;
    }
  }
}

export default new AchievementCheckerService();

