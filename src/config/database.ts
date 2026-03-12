import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import env from './env';
import logger from '../utils/logger';

// Connection pool configuration for Prisma 7
const poolConfig = {
  max: 10, // Maximum number of clients in the pool
  min: 2, // Minimum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
};

// Connection pool
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ...poolConfig,
});

// Adapter for Prisma 7 (adapter pattern)
const adapter = new PrismaPg(pool);

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

// Graceful shutdown
const gracefulShutdown = async () => {
  logger.info('Disconnecting from database...');
  await prisma.$disconnect();
  await pool.end();
  logger.info('Database disconnected');
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

export default prisma;