import { FastifyInstance } from 'fastify';
import userController from '../controllers/user.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireTeacher } from '../middleware/role.middleware';
import multipart from '@fastify/multipart';

export default async function usersRoutes(fastify: FastifyInstance) {
  // Register multipart for file uploads (avatar)
  await fastify.register(multipart, {
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB for avatars
      fieldSize: 1024 * 1024, // 1MB for fields
      fields: 10, // Maximum number of fields
      files: 1, // Only one file (avatar)
    },
    attachFieldsToBody: false, // Keep default behavior - parse fields manually
  });

  // Get all users - Teacher only
  fastify.get('/', { preHandler: [authenticate, requireTeacher()] }, userController.getUsers.bind(userController));

  // Create user - Teacher only
  fastify.post('/', { preHandler: [authenticate, requireTeacher()] }, userController.createUser.bind(userController));

  // Get user by ID - Protected
  fastify.get('/:id', { preHandler: [authenticate] }, userController.getUserById.bind(userController));

  // Update user - Protected (supports multipart for avatar upload)
  fastify.put('/:id', { preHandler: [authenticate] }, userController.updateUser.bind(userController));

  // Delete user - Teacher only
  fastify.delete('/:id', { preHandler: [authenticate, requireTeacher()] }, userController.deleteUser.bind(userController));

  // Reset password siswa - Teacher only (guru reset password siswa tanpa perlu tahu password lama)
  fastify.put('/:id/reset-password', { preHandler: [authenticate, requireTeacher()] }, userController.resetStudentPassword.bind(userController));

  // Ganti password sendiri - Protected (user ganti password diri sendiri, perlu verifikasi password lama)
  fastify.put('/:id/change-password', { preHandler: [authenticate] }, userController.changePassword.bind(userController));
}

