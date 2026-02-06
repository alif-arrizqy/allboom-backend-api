import { FastifyInstance } from 'fastify';
import certificateController from '../controllers/certificate.controller';
import { authenticate } from '../middleware/auth.middleware';

export default async function certificatesRoutes(fastify: FastifyInstance) {
  // Create certificate (student) - requires auth
  fastify.post('/', { preHandler: [authenticate] }, certificateController.createCertificate.bind(certificateController));

  // View certificate by token (public)
  fastify.get('/:token', certificateController.getCertificate.bind(certificateController));
}
