import prisma from '../config/database';
import { UserRole } from '@prisma/client';
import { PaginationResult } from '../utils/pagination';
import { ErrorMessages } from '../constants/error-messages';
import bcrypt from 'bcrypt';
import { ErrorStatusCodes } from '../constants/error-messages';

export interface UserFilters {
  role?: UserRole;
  search?: string;
  classId?: string;
}

function formatDateToYYYYMMDD(date: Date | null | undefined): string | null {
  if (!date) return null;
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatUserResponse(user: any): any {
  if (!user) return user;
  return {
    ...user,
    birthdate: formatDateToYYYYMMDD(user.birthdate),
  };
}

export class UserService {
  async findUsers(filters: UserFilters, pagination: PaginationResult) {
    const where: any = {};

    if (filters.role) {
      where.role = filters.role;
    }

    if (filters.classId) {
      where.classId = filters.classId;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { nip: { contains: filters.search, mode: 'insensitive' } },
        { nis: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
      select: {
        id: true,
        email: true,
        nip: true,
        nis: true,
        name: true,
        role: true,
        avatar: true,
        phone: true,
        className: true,
        classId: true,
        isActive: true,
        birthdate: true
      },
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    const formattedUsers = users.map(formatUserResponse);

    return { users: formattedUsers, total };
  }

  async findUserById(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        nip: true,
        nis: true,
        name: true,
        role: true,
        avatar: true,
        phone: true,
        address: true,
        bio: true,
        birthdate: true,
        className: true,
        classId: true,
        isActive: true
      }
    });

    if (!user) {
      throw new Error(ErrorMessages.RESOURCE.USER_NOT_FOUND);
    }

    return formatUserResponse(user);
  }

  async createUser(data: {
    email?: string;
    nip?: string;
    nis?: string;
    password: string;
    name: string;
    role: UserRole;
    phone?: string;
    address?: string;
    bio?: string;
    birthdate?: Date;
    classId?: string;
    classIds?: string[];
  }) {
    if (data.role === UserRole.STUDENT && !data.nis) {
      throw new Error('Student must have NIS');
    }

    if (data.role === UserRole.TEACHER && !data.nip) {
      throw new Error('Teacher must have NIP');
    }

    if (data.role === UserRole.STUDENT && !data.classId) {
      throw new Error('Student must have classId');
    }

    if (data.nip) {
      const existingNIP = await prisma.user.findUnique({
        where: { nip: data.nip },
      });
      if (existingNIP) {
        throw new Error('NIP already exists');
      }
    }

    if (data.nis) {
      const existingNIS = await prisma.user.findUnique({
        where: { nis: data.nis },
      });
      if (existingNIS) {
        throw new Error('NIS already exists');
      }
    }

    if (data.email) {
      const existingEmail = await prisma.user.findUnique({
        where: { email: data.email },
      });
      if (existingEmail) {
        throw new Error('Email already exists');
      }
    }

    let className: string | undefined;
    if (data.classId) {
      const classRecord = await prisma.class.findUnique({
        where: { id: data.classId },
      });
      if (!classRecord) {
        throw new Error('Class not found');
      }
      className = classRecord.name;
    }

    if (data.classIds && data.classIds.length > 0) {
      const classes = await prisma.class.findMany({
        where: { id: { in: data.classIds } },
      });
      if (classes.length !== data.classIds.length) {
        throw new Error('One or more classes not found');
      }
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: {
        email: data.email,
        nip: data.nip,
        nis: data.nis,
        password: hashedPassword,
        name: data.name,
        role: data.role,
        phone: data.phone,
        address: data.address,
        bio: data.bio,
        birthdate: data.birthdate,
        classId: data.classId,
        className,
      },
      select: {
        id: true,
        email: true,
        nip: true,
        nis: true,
        name: true,
        role: true,
        avatar: true,
        phone: true,
        address: true,
        bio: true,
        birthdate: true,
        className: true,
        classId: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (data.role === UserRole.TEACHER && data.classIds && data.classIds.length > 0) {
      await prisma.teacherClass.createMany({
        data: data.classIds.map((classId) => ({
          teacherId: user.id,
          classId,
        })),
        skipDuplicates: true,
      });
    }

    return formatUserResponse(user);
  }

  async updateUser(userId: string, data: any) {
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!existingUser) {
        throw new Error(ErrorMessages.RESOURCE.USER_NOT_FOUND);
      }

      const { classIds, ...updateData } = data;

      if (updateData.classId) {
      const classRecord = await prisma.class.findUnique({
        where: { id: updateData.classId },
      });
      if (!classRecord) {
        throw new Error('Class not found');
        }
      updateData.className = classRecord.name;
      }

      if (classIds && classIds.length > 0) {
      if (existingUser.role !== UserRole.TEACHER) {
        throw new Error('classIds can only be updated for teachers');
      }
      const classes = await prisma.class.findMany({
        where: { id: { in: classIds } },
      });
      if (classes.length !== classIds.length) {
        throw new Error('One or more classes not found');
        }
      }

      if (updateData.birthdate && typeof updateData.birthdate === 'string') {
        if (/^\d{4}-\d{2}-\d{2}$/.test(updateData.birthdate)) {
        updateData.birthdate = new Date(updateData.birthdate);
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        nip: true,
        nis: true,
        name: true,
        role: true,
        avatar: true,
        phone: true,
        address: true,
        bio: true,
        birthdate: true,
        className: true,
        classId: true,
        isActive: true,
        updatedAt: true,
      },
    });

    if (existingUser.role === UserRole.TEACHER && classIds !== undefined) {
      await prisma.teacherClass.deleteMany({
        where: { teacherId: userId },
      });

      if (classIds.length > 0) {
        await prisma.teacherClass.createMany({
          data: classIds.map((classId: string) => ({
            teacherId: userId,
            classId,
          })),
          skipDuplicates: true,
        });
      }
    }

    return formatUserResponse(user);
  }

  async deleteUser(userId: string) {
    await prisma.user.delete({
      where: { id: userId },
    });
  }

  /**
   * Reset password user (digunakan guru untuk reset password siswa).
   * Tidak memerlukan verifikasi password lama.
   */
  async resetPassword(userId: string, newPassword: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!user) {
      throw new Error(ErrorMessages.RESOURCE.USER_NOT_FOUND);
    }

    if (newPassword.length < 6) {
      throw Object.assign(new Error('Password minimal 6 karakter'), { statusCode: ErrorStatusCodes.BAD_REQUEST });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        // Increment tokenVersion agar semua sesi aktif user tersebut di-invalidate
        tokenVersion: { increment: 1 },
      },
    });
  }

  /**
   * Ganti password sendiri (digunakan user untuk ganti password mereka sendiri).
   * Memerlukan verifikasi password lama.
   */
  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true },
    });

    if (!user) {
      throw new Error(ErrorMessages.RESOURCE.USER_NOT_FOUND);
    }

    const isValid = await bcrypt.compare(oldPassword, user.password);
    if (!isValid) {
      throw Object.assign(new Error('Password lama tidak sesuai'), { statusCode: ErrorStatusCodes.BAD_REQUEST });
    }

    if (newPassword.length < 6) {
      throw Object.assign(new Error('Password baru minimal 6 karakter'), { statusCode: ErrorStatusCodes.BAD_REQUEST });
    }

    if (oldPassword === newPassword) {
      throw Object.assign(new Error('Password baru tidak boleh sama dengan password lama'), { statusCode: ErrorStatusCodes.BAD_REQUEST });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        // Increment tokenVersion agar sesi lain di-invalidate
        tokenVersion: { increment: 1 },
      },
    });
  }
}

export default new UserService();

