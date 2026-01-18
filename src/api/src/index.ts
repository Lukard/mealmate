/**
 * API Entry Point
 * Starts the Hono server with Node.js adapter
 */

import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { checkConnection, closeDatabase } from './db/client.js';

// Configuration
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

/**
 * Bootstrap and start the server
 */
async function bootstrap(): Promise<void> {
  console.log('Starting Meal Automation API...');

  // Check database connection
  console.log('Checking database connection...');
  const dbConnected = await checkConnection();

  if (!dbConnected) {
    console.warn('Warning: Database connection failed. Some features may not work.');
    console.warn('Make sure PostgreSQL is running and DATABASE_URL is set correctly.');
  } else {
    console.log('Database connection successful.');
  }

  // Create the Hono app
  const app = createApp();

  // Start server
  const server = serve({
    fetch: app.fetch,
    port: PORT,
    hostname: HOST,
  });

  console.log(`
========================================
  Meal Automation API
========================================
  Server:   http://${HOST}:${PORT}
  API:      http://${HOST}:${PORT}/api/v1
  Docs:     http://${HOST}:${PORT}/api/v1/docs
  Health:   http://${HOST}:${PORT}/api/v1/health

  Environment: ${process.env.NODE_ENV || 'development'}
  Node: ${process.version}
========================================
  `);

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\nReceived ${signal}. Shutting down gracefully...`);

    // Close server
    server.close(() => {
      console.log('HTTP server closed.');
    });

    // Close database
    try {
      await closeDatabase();
      console.log('Database connection closed.');
    } catch (error) {
      console.error('Error closing database:', error);
    }

    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });
}

// Start the server
bootstrap().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
