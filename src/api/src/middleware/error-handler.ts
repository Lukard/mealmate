/**
 * Global Error Handler Middleware
 * Standardized error responses and logging
 */

import { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';
import { v4 as uuidv4 } from 'uuid';

/**
 * Standard error response structure
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId: string;
  };
}

/**
 * Known error codes
 */
export const ErrorCodes = {
  // Authentication errors
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  AUTH_MISSING_TOKEN: 'AUTH_MISSING_TOKEN',
  AUTH_INSUFFICIENT_PERMISSIONS: 'AUTH_INSUFFICIENT_PERMISSIONS',
  AUTH_USER_NOT_FOUND: 'AUTH_USER_NOT_FOUND',

  // Resource errors
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',

  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_REQUEST: 'INVALID_REQUEST',

  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // Business logic errors
  SUPERMARKET_NOT_SUPPORTED: 'SUPERMARKET_NOT_SUPPORTED',
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
  MATCHING_FAILED: 'MATCHING_FAILED',
  CART_SESSION_EXPIRED: 'CART_SESSION_EXPIRED',

  // Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  SCRAPER_UNAVAILABLE: 'SCRAPER_UNAVAILABLE',
} as const;

/**
 * Map HTTP status to default error code
 */
function getDefaultErrorCode(status: number): string {
  switch (status) {
    case 400:
      return ErrorCodes.VALIDATION_ERROR;
    case 401:
      return ErrorCodes.AUTH_TOKEN_INVALID;
    case 403:
      return ErrorCodes.AUTH_INSUFFICIENT_PERMISSIONS;
    case 404:
      return ErrorCodes.RESOURCE_NOT_FOUND;
    case 409:
      return ErrorCodes.DUPLICATE_RESOURCE;
    case 429:
      return ErrorCodes.RATE_LIMIT_EXCEEDED;
    default:
      return ErrorCodes.INTERNAL_ERROR;
  }
}

/**
 * Format Zod validation errors
 */
function formatZodErrors(error: ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.join('.') || 'root';
    if (!errors[path]) {
      errors[path] = [];
    }
    errors[path].push(issue.message);
  }

  return errors;
}

/**
 * Create error response
 */
function createErrorResponse(
  code: string,
  message: string,
  requestId: string,
  details?: unknown
): ErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
      requestId,
    },
  };
}

/**
 * Log error for monitoring
 */
function logError(
  requestId: string,
  error: unknown,
  context: {
    method: string;
    path: string;
    status: number;
  }
): void {
  const timestamp = new Date().toISOString();
  const errorInfo = {
    requestId,
    timestamp,
    method: context.method,
    path: context.path,
    status: context.status,
    error: error instanceof Error
      ? {
          name: error.name,
          message: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        }
      : error,
  };

  // In production, send to logging service
  // For now, console log
  if (context.status >= 500) {
    console.error('[ERROR]', JSON.stringify(errorInfo, null, 2));
  } else if (process.env.NODE_ENV === 'development') {
    console.warn('[WARN]', JSON.stringify(errorInfo, null, 2));
  }
}

/**
 * Error handler middleware
 */
export async function errorHandler(c: Context, next: Next): Promise<Response | void> {
  // Generate request ID
  const requestId = c.req.header('X-Request-ID') || uuidv4();
  c.header('X-Request-ID', requestId);

  try {
    await next();
  } catch (error) {
    const method = c.req.method;
    const path = c.req.path;

    // Handle HTTP exceptions (from our code)
    if (error instanceof HTTPException) {
      const status = error.status;
      const cause = error.cause as { code?: string; details?: unknown } | undefined;
      const code = cause?.code || getDefaultErrorCode(status);
      const details = cause?.details;

      logError(requestId, error, { method, path, status });

      return c.json(
        createErrorResponse(code, error.message, requestId, details),
        status
      );
    }

    // Handle Zod validation errors
    if (error instanceof ZodError) {
      const status = 400;
      const details = formatZodErrors(error);

      logError(requestId, error, { method, path, status });

      return c.json(
        createErrorResponse(
          ErrorCodes.VALIDATION_ERROR,
          'Validation failed',
          requestId,
          details
        ),
        status
      );
    }

    // Handle unexpected errors
    const status = 500;
    const message =
      process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : error instanceof Error
          ? error.message
          : 'Unknown error';

    logError(requestId, error, { method, path, status });

    return c.json(
      createErrorResponse(ErrorCodes.INTERNAL_ERROR, message, requestId),
      status
    );
  }
}

/**
 * Not found handler - for unmatched routes
 */
export function notFoundHandler(c: Context): Response {
  const requestId = c.req.header('X-Request-ID') || uuidv4();
  c.header('X-Request-ID', requestId);

  return c.json(
    createErrorResponse(
      ErrorCodes.RESOURCE_NOT_FOUND,
      `Route ${c.req.method} ${c.req.path} not found`,
      requestId
    ),
    404
  );
}
