import { z } from 'zod';
import { UserRole } from '@prisma/client';


// Custom schema for birthdate that accepts YYYY-MM-DD format
const birthdateSchema = z.preprocess(
  (val) => {
    if (val instanceof Date) {
      return val;
    }
    if (typeof val === 'string') {
      // Check if it's in YYYY-MM-DD format
      if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
        const date = new Date(val);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
      // Try to parse as date string
      const date = new Date(val);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    return val;
  },
  z.date().optional()
);

export const createUserSchema = z
  .object({
    email: z.string().email().optional(),
    nip: z.string().min(1).optional(), // For TEACHER
    nis: z.string().min(1).optional(), // For STUDENT
    password: z.string().min(6, 'Password minimal 6 karakter'),
    name: z.string().min(1, 'Nama wajib diisi'),
    role: z.nativeEnum(UserRole),
    phone: z.string().optional(),
    address: z.string().optional(),
    bio: z.string().optional(),
    birthdate: birthdateSchema,
    classId: z.string().uuid().optional(), // For STUDENT (required)
    classIds: z.array(z.string().uuid()).optional(), // For TEACHER (optional)
  })
  .refine(
    (data) => {
      if (data.role === UserRole.STUDENT) {
        return !!data.nis;
      }
      if (data.role === UserRole.TEACHER) {
        return !!data.nip;
      }
      return true;
    },
    {
      message: 'Siswa wajib mengisi NIS, guru wajib mengisi NIP.',
      path: ['nip'],
    }
  )
  .refine(
    (data) => {
      // Student must have classId
      if (data.role === UserRole.STUDENT) {
        return !!data.classId;
      }
      return true;
    },
    {
      message: 'Siswa wajib memilih kelas.',
      path: ['classId'],
    }
  )
  .refine(
    (data) => {
      // classId only for students
      if (data.classId && data.role !== UserRole.STUDENT) {
        return false;
      }
      return true;
    },
    {
      message: 'Kelas (classId) hanya untuk akun siswa.',
      path: ['classId'],
    }
  )
  .refine(
    (data) => {
      // classIds only for teachers
      if (data.classIds && data.role !== UserRole.TEACHER) {
        return false;
      }
      return true;
    },
    {
      message: 'Daftar kelas mengajar hanya untuk akun guru.',
      path: ['classIds'],
    }
  );

export const updateUserSchema = z.object({
  email: z.string().email().optional(),
  nip: z.string().min(1).optional(),
  nis: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  bio: z.string().optional(),
  birthdate: birthdateSchema,
  classId: z.string().uuid().optional(), // For STUDENT
  classIds: z.array(z.string().uuid()).optional(), // For TEACHER
  isActive: z.boolean().optional(),
});

export const queryUsersSchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional().default(() => 1),
  limit: z.string().transform(Number).pipe(z.number().int().positive().max(100)).optional().default(() => 10),
  role: z.nativeEnum(UserRole).optional(),
  search: z.string().optional(),
  classId: z.string().uuid().optional(),
});

