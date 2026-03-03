import { z } from 'zod';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1),
  // Optional: Direct connection URL for migrations (when using connection pooler)
  // If not provided, DATABASE_URL will be used for migrations
  DIRECT_URL: z.string().optional(),

  // Server
  PORT: z.string().default('3000').transform(Number).pipe(z.number().int().positive()),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
  JWT_ACCESS_EXPIRES: z.string().default('1h'),
  JWT_REFRESH_EXPIRES: z.string().default('7d'),

  // File Upload
  MAX_FILE_SIZE: z.string().default('10485760').transform(Number).pipe(z.number().int().positive()), // 10MB default
  UPLOAD_DIR: z.string().default('./uploads'),

  // Image Processing
  IMAGE_MIN_WIDTH: z.string().default('200').transform(Number).pipe(z.number().int().positive()),
  IMAGE_MIN_HEIGHT: z.string().default('600').transform(Number).pipe(z.number().int().positive()),
  IMAGE_MAX_WIDTH: z.string().default('8000').transform(Number).pipe(z.number().int().positive()),
  IMAGE_MAX_HEIGHT: z.string().default('8000').transform(Number).pipe(z.number().int().positive()),
  IMAGE_THUMBNAIL_SIZE: z.string().default('300').transform(Number).pipe(z.number().int().positive()),
  IMAGE_MEDIUM_SIZE: z.string().default('800').transform(Number).pipe(z.number().int().positive()),
  IMAGE_QUALITY: z.string().default('90').transform(Number).pipe(z.number().int().min(1).max(100)),

  // Supabase Storage
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_STORAGE_BUCKET_AVATARS: z.string().default('avatars'),
  SUPABASE_STORAGE_BUCKET_SUBMISSIONS: z.string().default('submissions'),
  SUPABASE_STORAGE_BUCKET_TEMP: z.string().default('temp'),
  SUPABASE_STORAGE_BUCKET_CERTIFICATES: z.string().default('certificates'),
  SUPABASE_STORAGE_BUCKET_MATERIALS: z.string().default('materials'),

  // CORS - Comma-separated list of allowed origins
  CORS_ORIGIN: z.string().optional(),

  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

let env: Env;

try {
  env = envSchema.parse(process.env);
} catch (error: any) {
  if (error instanceof z.ZodError && error.issues && Array.isArray(error.issues)) {
    console.error('❌ Invalid environment variables:');
    error.issues.forEach((issue: any) => {
      if (issue && typeof issue === 'object') {
        const path = (issue.path && Array.isArray(issue.path))
          ? issue.path.join('.')
          : 'unknown';
        const message = issue.message || 'Validation error';
        console.error(`  - ${path}: ${message}`);
      }
    });
    process.exit(1);
  } else {
    console.error('❌ Error loading environment variables:', error?.message || error);
    process.exit(1);
  }
}

export default env;

