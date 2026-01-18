/**
 * Authentication Middleware
 * JWT token validation and user context injection
 */

import { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import jwt from 'jsonwebtoken';
import { db, schema } from '../db/client.js';
import { eq } from 'drizzle-orm';

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

/**
 * JWT payload structure
 */
export interface JWTPayload {
  sub: string; // User ID
  email: string;
  iat: number;
  exp: number;
}

/**
 * Authenticated user context
 */
export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

/**
 * Variables added to context by auth middleware
 */
declare module 'hono' {
  interface ContextVariableMap {
    user: AuthUser;
    userId: string;
  }
}

/**
 * Generate JWT access token
 */
export function generateAccessToken(user: { id: string; email: string }): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Generate refresh token
 */
export function generateRefreshToken(): string {
  const token = crypto.randomUUID() + crypto.randomUUID();
  return token.replace(/-/g, '');
}

/**
 * Calculate refresh token expiry date
 */
export function getRefreshTokenExpiry(): Date {
  const match = REFRESH_TOKEN_EXPIRES_IN.match(/^(\d+)([dhms])$/);
  if (!match) {
    throw new Error('Invalid REFRESH_TOKEN_EXPIRES_IN format');
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const now = new Date();
  switch (unit) {
    case 'd':
      now.setDate(now.getDate() + value);
      break;
    case 'h':
      now.setHours(now.getHours() + value);
      break;
    case 'm':
      now.setMinutes(now.getMinutes() + value);
      break;
    case 's':
      now.setSeconds(now.getSeconds() + value);
      break;
  }

  return now;
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): JWTPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new HTTPException(401, {
        message: 'Token has expired',
        cause: { code: 'AUTH_TOKEN_EXPIRED' },
      });
    }
    throw new HTTPException(401, {
      message: 'Invalid token',
      cause: { code: 'AUTH_TOKEN_INVALID' },
    });
  }
}

/**
 * Extract bearer token from Authorization header
 */
function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * Authentication middleware - requires valid JWT token
 */
export async function authMiddleware(c: Context, next: Next): Promise<Response | void> {
  const authHeader = c.req.header('Authorization');
  const token = extractBearerToken(authHeader);

  if (!token) {
    throw new HTTPException(401, {
      message: 'Authorization token required',
      cause: { code: 'AUTH_MISSING_TOKEN' },
    });
  }

  const payload = verifyToken(token);

  // Fetch user from database
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, payload.sub),
    columns: {
      id: true,
      email: true,
      name: true,
    },
  });

  if (!user) {
    throw new HTTPException(401, {
      message: 'User not found',
      cause: { code: 'AUTH_USER_NOT_FOUND' },
    });
  }

  // Set user context
  c.set('user', user);
  c.set('userId', user.id);

  await next();
}

/**
 * Optional authentication middleware - sets user if token present, continues otherwise
 */
export async function optionalAuthMiddleware(c: Context, next: Next): Promise<Response | void> {
  const authHeader = c.req.header('Authorization');
  const token = extractBearerToken(authHeader);

  if (token) {
    try {
      const payload = verifyToken(token);
      const user = await db.query.users.findFirst({
        where: eq(schema.users.id, payload.sub),
        columns: {
          id: true,
          email: true,
          name: true,
        },
      });

      if (user) {
        c.set('user', user);
        c.set('userId', user.id);
      }
    } catch {
      // Token invalid but optional - continue without user
    }
  }

  await next();
}

/**
 * Get current user from context (for use in routes after auth middleware)
 */
export function getCurrentUser(c: Context): AuthUser {
  const user = c.get('user');
  if (!user) {
    throw new HTTPException(401, {
      message: 'Not authenticated',
      cause: { code: 'AUTH_NOT_AUTHENTICATED' },
    });
  }
  return user;
}

/**
 * Get current user ID from context
 */
export function getCurrentUserId(c: Context): string {
  const userId = c.get('userId');
  if (!userId) {
    throw new HTTPException(401, {
      message: 'Not authenticated',
      cause: { code: 'AUTH_NOT_AUTHENTICATED' },
    });
  }
  return userId;
}
