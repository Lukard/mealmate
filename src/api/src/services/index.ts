/**
 * Services Index
 * Service injection and exports
 *
 * This module provides a centralized location for service initialization
 * and dependency injection for the API layer.
 */

import { db, schema } from '../db/client.js';

// Export database for services
export { db, schema };

/**
 * Service container interface
 */
export interface ServiceContainer {
  db: typeof db;
  config: AppConfig;
}

/**
 * Application configuration
 */
export interface AppConfig {
  env: 'development' | 'production' | 'test';
  port: number;
  host: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  refreshTokenExpiresIn: string;
  databaseUrl: string;
  corsOrigins: string[];
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
}

/**
 * Load configuration from environment
 */
export function loadConfig(): AppConfig {
  const env = (process.env.NODE_ENV || 'development') as AppConfig['env'];

  return {
    env,
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
    jwtSecret: process.env.JWT_SECRET || 'your-super-secret-key-change-in-production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
    databaseUrl: process.env.DATABASE_URL || 'postgres://localhost:5432/meal_automation',
    corsOrigins: process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:5173',
    ],
    rateLimit: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    },
  };
}

/**
 * Create service container
 */
export function createServiceContainer(): ServiceContainer {
  const config = loadConfig();

  return {
    db,
    config,
  };
}

// Export types for use in route handlers
export type { Database } from '../db/client.js';
