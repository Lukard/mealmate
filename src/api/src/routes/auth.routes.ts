/**
 * Authentication Routes
 * Register, login, refresh token, logout
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { eq, and, gt } from 'drizzle-orm';
import { db, schema } from '../db/client.js';
import {
  generateAccessToken,
  generateRefreshToken,
  getRefreshTokenExpiry,
  authMiddleware,
  getCurrentUserId,
} from '../middleware/auth.middleware.js';
import { rateLimiters } from '../middleware/rate-limit.js';

const auth = new Hono();

// ============================================
// Validation Schemas
// ============================================

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
  name: z.string().min(1, 'Name is required').max(255),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// ============================================
// Routes
// ============================================

/**
 * POST /auth/register
 * Create a new user account
 */
auth.post('/register', rateLimiters.auth, async (c) => {
  const body = await c.req.json();
  const { email, password, name } = registerSchema.parse(body);

  // Check if user already exists
  const existingUser = await db.query.users.findFirst({
    where: eq(schema.users.email, email.toLowerCase()),
  });

  if (existingUser) {
    throw new HTTPException(409, {
      message: 'An account with this email already exists',
      cause: { code: 'DUPLICATE_RESOURCE' },
    });
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 12);

  // Create user
  const [newUser] = await db
    .insert(schema.users)
    .values({
      email: email.toLowerCase(),
      name,
      passwordHash,
      emailVerified: false,
    })
    .returning({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      emailVerified: schema.users.emailVerified,
      createdAt: schema.users.createdAt,
    });

  // Create user profile
  await db.insert(schema.userProfiles).values({
    userId: newUser.id,
  });

  // Generate tokens
  const accessToken = generateAccessToken({ id: newUser.id, email: newUser.email });
  const refreshToken = generateRefreshToken();
  const refreshExpiry = getRefreshTokenExpiry();

  // Store refresh token
  await db.insert(schema.refreshTokens).values({
    userId: newUser.id,
    token: refreshToken,
    expiresAt: refreshExpiry,
  });

  return c.json(
    {
      success: true,
      data: {
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          emailVerified: newUser.emailVerified,
          createdAt: newUser.createdAt,
        },
        accessToken,
        refreshToken,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes
      },
    },
    201
  );
});

/**
 * POST /auth/login
 * Authenticate user and receive tokens
 */
auth.post('/login', rateLimiters.auth, async (c) => {
  const body = await c.req.json();
  const { email, password } = loginSchema.parse(body);

  // Find user by email
  const user = await db.query.users.findFirst({
    where: eq(schema.users.email, email.toLowerCase()),
  });

  if (!user || !user.passwordHash) {
    throw new HTTPException(401, {
      message: 'Invalid email or password',
      cause: { code: 'AUTH_INVALID_CREDENTIALS' },
    });
  }

  // Verify password
  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) {
    throw new HTTPException(401, {
      message: 'Invalid email or password',
      cause: { code: 'AUTH_INVALID_CREDENTIALS' },
    });
  }

  // Generate tokens
  const accessToken = generateAccessToken({ id: user.id, email: user.email });
  const refreshToken = generateRefreshToken();
  const refreshExpiry = getRefreshTokenExpiry();

  // Store refresh token
  await db.insert(schema.refreshTokens).values({
    userId: user.id,
    token: refreshToken,
    expiresAt: refreshExpiry,
  });

  return c.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      },
      accessToken,
      refreshToken,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    },
  });
});

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 */
auth.post('/refresh', rateLimiters.auth, async (c) => {
  const body = await c.req.json();
  const { refreshToken } = refreshSchema.parse(body);

  // Find valid refresh token
  const tokenRecord = await db.query.refreshTokens.findFirst({
    where: and(
      eq(schema.refreshTokens.token, refreshToken),
      gt(schema.refreshTokens.expiresAt, new Date())
    ),
    with: {
      // Note: this requires relations to be set up
    },
  });

  if (!tokenRecord || tokenRecord.revokedAt) {
    throw new HTTPException(401, {
      message: 'Invalid or expired refresh token',
      cause: { code: 'AUTH_TOKEN_INVALID' },
    });
  }

  // Find user
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, tokenRecord.userId),
  });

  if (!user) {
    throw new HTTPException(401, {
      message: 'User not found',
      cause: { code: 'AUTH_USER_NOT_FOUND' },
    });
  }

  // Revoke old refresh token
  await db
    .update(schema.refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(schema.refreshTokens.id, tokenRecord.id));

  // Generate new tokens
  const newAccessToken = generateAccessToken({ id: user.id, email: user.email });
  const newRefreshToken = generateRefreshToken();
  const refreshExpiry = getRefreshTokenExpiry();

  // Store new refresh token
  await db.insert(schema.refreshTokens).values({
    userId: user.id,
    token: newRefreshToken,
    expiresAt: refreshExpiry,
  });

  return c.json({
    success: true,
    data: {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    },
  });
});

/**
 * POST /auth/logout
 * Invalidate current session
 */
auth.post('/logout', authMiddleware, async (c) => {
  const userId = getCurrentUserId(c);

  // Get authorization header to find the refresh token
  // In a real implementation, you might want to pass the refresh token explicitly
  // For now, we'll revoke all refresh tokens for this user

  await db
    .update(schema.refreshTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(schema.refreshTokens.userId, userId),
        gt(schema.refreshTokens.expiresAt, new Date())
      )
    );

  return c.body(null, 204);
});

/**
 * POST /auth/forgot-password
 * Request password reset email
 */
auth.post('/forgot-password', rateLimiters.auth, async (c) => {
  const body = await c.req.json();
  const { email } = z.object({ email: z.string().email() }).parse(body);

  // Find user by email
  const user = await db.query.users.findFirst({
    where: eq(schema.users.email, email.toLowerCase()),
  });

  // Always return success to prevent email enumeration
  // In a real implementation, send reset email if user exists

  if (user) {
    // TODO: Generate reset token and send email
    console.log(`Password reset requested for ${email}`);
  }

  return c.json({
    success: true,
    data: {
      message: 'If an account with that email exists, we have sent a password reset link.',
    },
  });
});

/**
 * POST /auth/reset-password
 * Reset password with token
 */
auth.post('/reset-password', rateLimiters.auth, async (c) => {
  const body = await c.req.json();
  const { token, newPassword } = z
    .object({
      token: z.string().min(1),
      newPassword: z
        .string()
        .min(8)
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
    })
    .parse(body);

  // TODO: Implement reset token verification
  // For now, return not implemented
  throw new HTTPException(501, {
    message: 'Password reset not yet implemented',
    cause: { code: 'NOT_IMPLEMENTED' },
  });
});

export default auth;
