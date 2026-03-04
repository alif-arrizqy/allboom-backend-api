import bcrypt from 'bcrypt';
import prisma from '../config/database';
import { UserRole } from '@prisma/client';
import logger from '../utils/logger';

export interface RegisterData {
  email?: string;
  nip?: string; // For TEACHER
  nis?: string; // For STUDENT
  password: string;
  name: string;
  role: UserRole;
  phone?: string;
  address?: string;
  bio?: string;
  birthdate?: Date;
  classId?: string; // For STUDENT (required)
  classIds?: string[]; // For TEACHER (optional)
}

export interface LoginData {
  identifier: string; // NIP for TEACHER, NIS for STUDENT
  password: string;
}

export class AuthService {
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  async register(data: RegisterData) {
    if (data.role === UserRole.STUDENT && !data.nis) {
      throw new Error('Student must have NIS');
    }

    if (data.role === UserRole.TEACHER && !data.nip) {
      throw new Error('Teacher must have NIP');
    }

    if (data.nis && data.role !== UserRole.STUDENT) {
      throw new Error('NIS is only allowed for students');
    }

    if (data.nip && data.role !== UserRole.TEACHER) {
      throw new Error('NIP is only allowed for teachers');
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

    // Validate classId for STUDENT
    if (data.role === UserRole.STUDENT && !data.classId) {
      throw new Error('Student must have classId');
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

    const hashedPassword = await this.hashPassword(data.password);
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

    logger.info({ userId: user.id, role: user.role }, 'User registered');
    return user;
  }

  async login(data: LoginData) {
    let user = null;

    user = await prisma.user.findUnique({
      where: { nip: data.identifier       },
    });

    if (!user) {
      user = await prisma.user.findUnique({
        where: { nis: data.identifier },
      });
    }

    if (!user) {
      throw new Error('Invalid credentials');
    }

    if (!user.isActive) {
      throw new Error('Account is inactive');
    }

    const isValidPassword = await this.comparePassword(data.password, user.password);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    logger.info({ userId: user.id, role: user.role }, 'User logged in');

    return {
      id: user.id,
      email: user.email,
      nip: user.nip,
      nis: user.nis,
      name: user.name,
      role: user.role,
      avatar: user.avatar,
      tokenVersion: user.tokenVersion,
    };
  }

  async incrementTokenVersion(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        tokenVersion: {
          increment: 1,
        },
      },
    });
    logger.info({ userId }, 'Token version incremented');
  }

  async getUserWithTokenVersion(userId: string) {
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
        tokenVersion: true,
        isActive: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  async getUserById(userId: string) {
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
        createdAt: true,
        updatedAt: true,
        teacherClasses: {
          select: {
            class: {
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

    if (!user) {
      throw new Error('User not found');
    }

    // Format response: if teacher, add classes array from teacherClasses
    if (user.role === UserRole.TEACHER) {
      const classes = user.teacherClasses.map((tc) => tc.class);
      const { teacherClasses, ...userWithoutTeacherClasses } = user;
      return {
        ...userWithoutTeacherClasses,
        classes,
      };
    }

    const { teacherClasses, ...userWithoutTeacherClasses } = user;
    return userWithoutTeacherClasses;
  }
}

export default new AuthService();

