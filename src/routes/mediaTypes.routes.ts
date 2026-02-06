import { FastifyInstance } from 'fastify';
import mediaTypeController from '../controllers/mediaType.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireTeacher } from '../middleware/role.middleware';

export default async function mediaTypesRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: [authenticate] }, mediaTypeController.getMediaTypes.bind(mediaTypeController));
  fastify.get('/:id', { preHandler: [authenticate] }, mediaTypeController.getMediaTypeById.bind(mediaTypeController));
  fastify.post('/', { preHandler: [authenticate, requireTeacher()] }, mediaTypeController.createMediaType.bind(mediaTypeController));
  fastify.put('/:id', { preHandler: [authenticate, requireTeacher()] }, mediaTypeController.updateMediaType.bind(mediaTypeController));
  fastify.delete('/:id', { preHandler: [authenticate, requireTeacher()] }, mediaTypeController.deleteMediaType.bind(mediaTypeController));
}
