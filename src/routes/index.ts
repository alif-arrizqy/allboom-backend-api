import { FastifyInstance } from 'fastify';
import authRoutes from './auth.routes';
import usersRoutes from './users.routes';
import assignmentsRoutes from './assignments.routes';
import submissionsRoutes from './submissions.routes';
import classesRoutes from './classes.routes';
import notificationsRoutes from './notifications.routes';
import certificatesRoutes from './certificates.routes';
import mediaTypesRoutes from './mediaTypes.routes';
import achievementsRoutes from './achievements.routes';
import portfolioRoutes from './portfolio.routes';
import dashboardRoutes from './dashboard.routes';
import exportRoutes from './export.routes';

export default async function routes(fastify: FastifyInstance) {
  // Register all routes with prefix
  await fastify.register(authRoutes, { prefix: '/auth' });
  await fastify.register(usersRoutes, { prefix: '/users' });
  await fastify.register(mediaTypesRoutes, { prefix: '/media-types' });
  await fastify.register(achievementsRoutes, { prefix: '/achievements' });
  await fastify.register(assignmentsRoutes, { prefix: '/assignments' });
  await fastify.register(submissionsRoutes, { prefix: '/submissions' });
  await fastify.register(classesRoutes, { prefix: '/classes' });
  await fastify.register(portfolioRoutes, { prefix: '/portfolio' });
  await fastify.register(dashboardRoutes, { prefix: '/dashboard' });
  await fastify.register(notificationsRoutes, { prefix: '/notifications' });
  await fastify.register(certificatesRoutes, { prefix: '/certificates' });
  await fastify.register(exportRoutes, { prefix: '/export' });
}

