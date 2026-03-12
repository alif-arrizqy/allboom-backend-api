import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import env from './env';
import logger from '../utils/logger';

// Connection pool configuration for Prisma 7
// Optimized for Supabase (Free tier: ~60 max connections, Pro: ~200)
// Using conservative pool settings to avoid hitting connection limits
const poolConfig: pg.PoolConfig = {
  connectionString: env.DATABASE_URL,
  max: 10, // Maximum number of clients in the pool (reduced for Supabase)
  min: 2, // Minimum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 5000, // Increased timeout for cloud connections (5 seconds)
  // Supabase requires SSL, ensure connection string includes SSL mode
};

// Connection pool (PrismaPg accepts Pool | PoolConfig; pass config so adapter owns the pool)
const pool = new pg.Pool(poolConfig);

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

