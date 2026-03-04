import { FastifyInstance } from 'fastify';
import classController from '../controllers/class.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireTeacher } from '../middleware/role.middleware';

export default async function classesRoutes(fastify: FastifyInstance) {
  // Get all classes - Public (needed for registration form)
  fastify.get('/', classController.getClasses.bind(classController));

  // Get class by ID - Protected
  fastify.get('/:id', { preHandler: [authenticate] }, classController.getClassById.bind(classController));

  // Create class - Teacher only
  fastify.post('/', { preHandler: [authenticate, requireTeacher()] }, classController.createClass.bind(classController));

  // Update class - Teacher only
  fastify.put('/:id', { preHandler: [authenticate, requireTeacher()] }, classController.updateClass.bind(classController));

  // Delete class - Teacher only
  fastify.delete('/:id', { preHandler: [authenticate, requireTeacher()] }, classController.deleteClass.bind(classController));
}

