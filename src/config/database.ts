import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import env from './env';
import logger from '../utils/logger';

// Pool config passed to PrismaPg so the adapter creates and owns the pool.
// Using plain object avoids type conflict between project's @types/pg and
// @prisma/adapter-pg's nested @types/pg (e.g. on Railway).
const poolConfig = {
  connectionString: env.DATABASE_URL,
  max: 10,
  min: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

// Adapter for Prisma 7 (adapter owns pool when given PoolConfig)
const adapter = new PrismaPg(poolConfig);

// Prisma Client with adapter
const prisma = new PrismaClient({
  adapter,
  log:
    env.NODE_ENV === 'development'
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'error' },
          { emit: 'event', level: 'warn' },
        ]
      : [{ emit: 'event', level: 'error' }],
});

// Log queries in development
if (env.NODE_ENV === 'development') {
  prisma.$on('query' as never, (e: any) => {
    logger.debug({ query: e.query, params: e.params, duration: `${e.duration}ms` }, 'Database query');
  });
}

prisma.$on('error' as never, (e: any) => {
  logger.error({ error: e }, 'Database error');
});

prisma.$on('warn' as never, (e: any) => {
  logger.warn({ warning: e }, 'Database warning');
});

// Graceful shutdown (adapter disposes its pool on $disconnect)
const gracefulShutdown = async () => {
  logger.info('Disconnecting from database...');
  await prisma.$disconnect();
  logger.info('Database disconnected');
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

export default prisma;

