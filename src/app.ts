import Fastify, { FastifyInstance } from 'fastify';
import errorHandler from './middleware/error.middleware';

// Plugins
import corsPlugin from './plugins/cors';

// Routes
import routes from './routes';

export async function buildApp(): Promise<FastifyInstance> {
  try {
    const app = Fastify({
      logger: false, // We use our custom logger
    });

    // Register CORS plugin globally (must be first)
    await app.register(corsPlugin);

    // Add hook to ensure CORS headers are always present
    app.addHook('onSend', async (request, reply) => {
      // Ensure CORS headers are set if not already present
      const origin = request.headers.origin;
      if (origin && !reply.getHeader('Access-Control-Allow-Origin')) {
        reply.header('Access-Control-Allow-Origin', origin);
        reply.header('Access-Control-Allow-Credentials', 'true');
      }
    });

    // Register routes with prefix
    await app.register(routes, { prefix: '/allboom/api/v1' });

    // Welcome endpoint
    app.get('/allboom', async () => {
      return { message: 'Welcome to Allboom API 🎨' };
    });

    // Health check endpoint
    app.get('/allboom/health', async () => {
      return { 
        success: true,
        status: 'ok', 
        timestamp: new Date().toISOString(),
        service: 'allboom-backend-api',
        version: '1.0.0',
      };
    });

    // Register error handler (must be last)
    errorHandler(app);

    return app;
  } catch (error: any) {
    console.error('❌ Error building app:', error?.message || error);
    if (error?.stack) {
      console.error('Stack trace:', error.stack);
    }
    throw error;
  }
}

