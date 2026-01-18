/**
 * Health Check Routes
 * System health monitoring endpoints
 */

import { Hono } from 'hono';
import { checkConnection, db, schema } from '../db/client.js';
import { sql } from 'drizzle-orm';

const health = new Hono();

/**
 * Basic health check data
 */
interface HealthData {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  timestamp: string;
  checks?: Record<string, CheckResult>;
}

interface CheckResult {
  status: 'pass' | 'fail' | 'warn';
  responseTime?: number;
  message?: string;
}

// Track server start time
const serverStartTime = Date.now();

/**
 * GET /health
 * Basic health check - returns 200 if service is running
 */
health.get('/', async (c) => {
  const healthData: HealthData = {
    status: 'healthy',
    version: process.env.npm_package_version || '0.1.0',
    uptime: Math.floor((Date.now() - serverStartTime) / 1000),
    timestamp: new Date().toISOString(),
  };

  return c.json({
    success: true,
    data: healthData,
  });
});

/**
 * GET /health/ready
 * Readiness check - verifies all dependencies are accessible
 */
health.get('/ready', async (c) => {
  const checks: Record<string, CheckResult> = {};
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  // Database check
  const dbStart = Date.now();
  try {
    const isConnected = await checkConnection();
    const dbTime = Date.now() - dbStart;

    if (isConnected) {
      checks.database = {
        status: dbTime > 1000 ? 'warn' : 'pass',
        responseTime: dbTime,
        message: dbTime > 1000 ? 'Slow database response' : undefined,
      };
      if (dbTime > 1000) overallStatus = 'degraded';
    } else {
      checks.database = {
        status: 'fail',
        responseTime: dbTime,
        message: 'Database connection failed',
      };
      overallStatus = 'unhealthy';
    }
  } catch (error) {
    const dbTime = Date.now() - dbStart;
    checks.database = {
      status: 'fail',
      responseTime: dbTime,
      message: error instanceof Error ? error.message : 'Database error',
    };
    overallStatus = 'unhealthy';
  }

  // Memory check
  const memoryUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
  const heapUsagePercent = (heapUsedMB / heapTotalMB) * 100;

  checks.memory = {
    status: heapUsagePercent > 90 ? 'warn' : 'pass',
    message: `${heapUsedMB}MB / ${heapTotalMB}MB (${heapUsagePercent.toFixed(1)}%)`,
  };

  if (heapUsagePercent > 90 && overallStatus === 'healthy') {
    overallStatus = 'degraded';
  }

  const healthData: HealthData = {
    status: overallStatus,
    version: process.env.npm_package_version || '0.1.0',
    uptime: Math.floor((Date.now() - serverStartTime) / 1000),
    timestamp: new Date().toISOString(),
    checks,
  };

  const statusCode = overallStatus === 'unhealthy' ? 503 : 200;

  return c.json(
    {
      success: overallStatus !== 'unhealthy',
      data: healthData,
    },
    statusCode
  );
});

/**
 * GET /health/live
 * Liveness check - simple ping to verify process is running
 */
health.get('/live', async (c) => {
  return c.json({
    success: true,
    data: {
      status: 'alive',
      timestamp: new Date().toISOString(),
    },
  });
});

/**
 * GET /health/metrics
 * Basic metrics endpoint
 */
health.get('/metrics', async (c) => {
  const memoryUsage = process.memoryUsage();

  // Get some database stats
  let dbStats = {
    users: 0,
    recipes: 0,
    products: 0,
    mealPlans: 0,
    groceryLists: 0,
  };

  try {
    const [usersCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.users);
    const [recipesCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.recipes);
    const [productsCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.products);
    const [mealPlansCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.mealPlans);
    const [groceryListsCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.groceryLists);

    dbStats = {
      users: Number(usersCount?.count || 0),
      recipes: Number(recipesCount?.count || 0),
      products: Number(productsCount?.count || 0),
      mealPlans: Number(mealPlansCount?.count || 0),
      groceryLists: Number(groceryListsCount?.count || 0),
    };
  } catch {
    // Stats unavailable
  }

  return c.json({
    success: true,
    data: {
      uptime: {
        seconds: Math.floor((Date.now() - serverStartTime) / 1000),
        human: formatUptime(Date.now() - serverStartTime),
      },
      memory: {
        heapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        rssMB: Math.round(memoryUsage.rss / 1024 / 1024),
        externalMB: Math.round(memoryUsage.external / 1024 / 1024),
      },
      process: {
        pid: process.pid,
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      database: dbStats,
      timestamp: new Date().toISOString(),
    },
  });
});

/**
 * Format uptime to human readable string
 */
function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

export default health;
