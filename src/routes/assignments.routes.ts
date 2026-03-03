import { FastifyInstance } from 'fastify';
import assignmentController from '../controllers/assignment.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireTeacher } from '../middleware/role.middleware';
import multipart from '@fastify/multipart';

export default async function assignmentsRoutes(fastify: FastifyInstance) {
  // Register multipart for materi file uploads
  await fastify.register(multipart, {
    limits: {
      fileSize: 20 * 1024 * 1024, // 20MB for documents
      fieldSize: 1024 * 1024,
      fields: 5,
      files: 1,
    },
    attachFieldsToBody: false,
  });

  // Get all assignments - Protected
  fastify.get('/', { preHandler: [authenticate] }, assignmentController.getAssignments.bind(assignmentController));

  // Get assignment by ID - Protected
  fastify.get('/:id', { preHandler: [authenticate] }, assignmentController.getAssignmentById.bind(assignmentController));

  // Upload materi file - Teacher only (call before create/update)
  fastify.post('/upload-materi', { preHandler: [authenticate, requireTeacher()] }, assignmentController.uploadMateri.bind(assignmentController));

  // Create assignment - Teacher only
  fastify.post('/', { preHandler: [authenticate, requireTeacher()] }, assignmentController.createAssignment.bind(assignmentController));

  // Update assignment - Teacher only
  fastify.put('/:id', { preHandler: [authenticate, requireTeacher()] }, assignmentController.updateAssignment.bind(assignmentController));

  // Delete assignment - Teacher only
  fastify.delete('/:id', { preHandler: [authenticate, requireTeacher()] }, assignmentController.deleteAssignment.bind(assignmentController));

  // Bulk update assignment status - Teacher only
  fastify.put('/bulk-status', { preHandler: [authenticate, requireTeacher()] }, assignmentController.bulkUpdateStatus.bind(assignmentController));

  // Bulk delete assignments - Teacher only
  fastify.delete('/bulk-delete', { preHandler: [authenticate, requireTeacher()] }, assignmentController.bulkDelete.bind(assignmentController));
}

