/**
 * User Routes
 * User profile management and preferences
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db, schema } from '../db/client.js';
import {
  authMiddleware,
  getCurrentUserId,
  getCurrentUser,
} from '../middleware/auth.middleware.js';
import { rateLimiters } from '../middleware/rate-limit.js';

const users = new Hono();

// Apply auth middleware to all routes
users.use('*', authMiddleware);
users.use('*', rateLimiters.authenticated);

// ============================================
// Validation Schemas
// ============================================

const updateProfileSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  profile: z
    .object({
      householdSize: z.number().min(1).max(20).optional(),
      budgetWeekly: z.number().min(0).optional().nullable(),
      preferredStores: z.array(z.string().uuid()).max(10).optional(),
      cookingSkill: z
        .enum(['beginner', 'intermediate', 'advanced', 'expert'])
        .optional(),
      maxPrepTime: z.number().min(5).max(480).optional().nullable(),
      cuisinePreferences: z.array(z.string()).max(20).optional(),
      dislikedIngredients: z.array(z.string()).max(100).optional(),
    })
    .optional(),
});

const updateRestrictionsSchema = z.object({
  restrictions: z.array(
    z.object({
      restrictionId: z.string().uuid(),
      severity: z.enum(['strict', 'prefer', 'avoid']),
    })
  ),
});

const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

// ============================================
// Routes
// ============================================

/**
 * GET /users/me
 * Get current user profile
 */
users.get('/me', async (c) => {
  const userId = getCurrentUserId(c);

  // Fetch user with profile and restrictions
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: {
      id: true,
      email: true,
      name: true,
      emailVerified: true,
      createdAt: true,
      updatedAt: true,
    },
    with: {
      profile: true,
      restrictions: {
        with: {
          // Would include restriction details if relations set up
        },
      },
    },
  });

  if (!user) {
    throw new HTTPException(404, {
      message: 'User not found',
      cause: { code: 'RESOURCE_NOT_FOUND' },
    });
  }

  // Fetch restriction details
  const userRestrictions = await db
    .select({
      id: schema.userRestrictions.id,
      severity: schema.userRestrictions.severity,
      restrictionId: schema.userRestrictions.restrictionId,
      name: schema.dietaryRestrictions.name,
      description: schema.dietaryRestrictions.description,
      icon: schema.dietaryRestrictions.icon,
    })
    .from(schema.userRestrictions)
    .innerJoin(
      schema.dietaryRestrictions,
      eq(schema.userRestrictions.restrictionId, schema.dietaryRestrictions.id)
    )
    .where(eq(schema.userRestrictions.userId, userId));

  return c.json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      profile: user.profile
        ? {
            householdSize: user.profile.householdSize,
            budgetWeekly: user.profile.budgetWeekly,
            preferredStores: user.profile.preferredStores,
            cookingSkill: user.profile.cookingSkill,
            maxPrepTime: user.profile.maxPrepTime,
            cuisinePreferences: user.profile.cuisinePreferences,
            dislikedIngredients: user.profile.dislikedIngredients,
          }
        : null,
      restrictions: userRestrictions.map((r) => ({
        id: r.id,
        restrictionId: r.restrictionId,
        name: r.name,
        description: r.description,
        icon: r.icon,
        severity: r.severity,
      })),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  });
});

/**
 * PUT /users/me
 * Update user profile
 */
users.put('/me', async (c) => {
  const userId = getCurrentUserId(c);
  const body = await c.req.json();
  const updates = updateProfileSchema.parse(body);

  // Update user name if provided
  if (updates.name !== undefined) {
    await db
      .update(schema.users)
      .set({
        name: updates.name,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, userId));
  }

  // Update profile if provided
  if (updates.profile) {
    const profileUpdates: Record<string, unknown> = {};

    if (updates.profile.householdSize !== undefined) {
      profileUpdates.householdSize = updates.profile.householdSize;
    }
    if (updates.profile.budgetWeekly !== undefined) {
      profileUpdates.budgetWeekly = updates.profile.budgetWeekly;
    }
    if (updates.profile.preferredStores !== undefined) {
      profileUpdates.preferredStores = updates.profile.preferredStores;
    }
    if (updates.profile.cookingSkill !== undefined) {
      profileUpdates.cookingSkill = updates.profile.cookingSkill;
    }
    if (updates.profile.maxPrepTime !== undefined) {
      profileUpdates.maxPrepTime = updates.profile.maxPrepTime;
    }
    if (updates.profile.cuisinePreferences !== undefined) {
      profileUpdates.cuisinePreferences = updates.profile.cuisinePreferences;
    }
    if (updates.profile.dislikedIngredients !== undefined) {
      profileUpdates.dislikedIngredients = updates.profile.dislikedIngredients;
    }

    if (Object.keys(profileUpdates).length > 0) {
      // Check if profile exists
      const existingProfile = await db.query.userProfiles.findFirst({
        where: eq(schema.userProfiles.userId, userId),
      });

      if (existingProfile) {
        await db
          .update(schema.userProfiles)
          .set(profileUpdates)
          .where(eq(schema.userProfiles.userId, userId));
      } else {
        await db.insert(schema.userProfiles).values({
          userId,
          ...profileUpdates,
        });
      }
    }
  }

  // Fetch updated user
  const updatedUser = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: {
      id: true,
      email: true,
      name: true,
      emailVerified: true,
      createdAt: true,
      updatedAt: true,
    },
    with: {
      profile: true,
    },
  });

  return c.json({
    success: true,
    data: {
      id: updatedUser!.id,
      email: updatedUser!.email,
      name: updatedUser!.name,
      emailVerified: updatedUser!.emailVerified,
      profile: updatedUser!.profile,
      createdAt: updatedUser!.createdAt,
      updatedAt: updatedUser!.updatedAt,
    },
  });
});

/**
 * PUT /users/me/preferences
 * Update user preferences (alias for profile update)
 */
users.put('/me/preferences', async (c) => {
  const userId = getCurrentUserId(c);
  const body = await c.req.json();
  const updates = updateProfileSchema.shape.profile.parse(body);

  if (!updates) {
    return c.json({
      success: true,
      data: { message: 'No updates provided' },
    });
  }

  const profileUpdates: Record<string, unknown> = {};

  if (updates.householdSize !== undefined) {
    profileUpdates.householdSize = updates.householdSize;
  }
  if (updates.budgetWeekly !== undefined) {
    profileUpdates.budgetWeekly = updates.budgetWeekly;
  }
  if (updates.preferredStores !== undefined) {
    profileUpdates.preferredStores = updates.preferredStores;
  }
  if (updates.cookingSkill !== undefined) {
    profileUpdates.cookingSkill = updates.cookingSkill;
  }
  if (updates.maxPrepTime !== undefined) {
    profileUpdates.maxPrepTime = updates.maxPrepTime;
  }
  if (updates.cuisinePreferences !== undefined) {
    profileUpdates.cuisinePreferences = updates.cuisinePreferences;
  }
  if (updates.dislikedIngredients !== undefined) {
    profileUpdates.dislikedIngredients = updates.dislikedIngredients;
  }

  // Upsert profile
  const existingProfile = await db.query.userProfiles.findFirst({
    where: eq(schema.userProfiles.userId, userId),
  });

  if (existingProfile) {
    await db
      .update(schema.userProfiles)
      .set(profileUpdates)
      .where(eq(schema.userProfiles.userId, userId));
  } else {
    await db.insert(schema.userProfiles).values({
      userId,
      ...profileUpdates,
    });
  }

  // Fetch updated profile
  const profile = await db.query.userProfiles.findFirst({
    where: eq(schema.userProfiles.userId, userId),
  });

  return c.json({
    success: true,
    data: profile,
  });
});

/**
 * PUT /users/me/restrictions
 * Update dietary restrictions
 */
users.put('/me/restrictions', async (c) => {
  const userId = getCurrentUserId(c);
  const body = await c.req.json();
  const { restrictions } = updateRestrictionsSchema.parse(body);

  // Validate restriction IDs exist
  const validRestrictionIds = await db.query.dietaryRestrictions.findMany({
    columns: { id: true },
  });
  const validIds = new Set(validRestrictionIds.map((r) => r.id));

  for (const r of restrictions) {
    if (!validIds.has(r.restrictionId)) {
      throw new HTTPException(400, {
        message: `Invalid restriction ID: ${r.restrictionId}`,
        cause: { code: 'VALIDATION_ERROR' },
      });
    }
  }

  // Delete existing restrictions
  await db
    .delete(schema.userRestrictions)
    .where(eq(schema.userRestrictions.userId, userId));

  // Insert new restrictions
  if (restrictions.length > 0) {
    await db.insert(schema.userRestrictions).values(
      restrictions.map((r) => ({
        userId,
        restrictionId: r.restrictionId,
        severity: r.severity,
      }))
    );
  }

  // Fetch updated restrictions
  const userRestrictions = await db
    .select({
      id: schema.userRestrictions.id,
      severity: schema.userRestrictions.severity,
      restrictionId: schema.userRestrictions.restrictionId,
      name: schema.dietaryRestrictions.name,
      description: schema.dietaryRestrictions.description,
      icon: schema.dietaryRestrictions.icon,
    })
    .from(schema.userRestrictions)
    .innerJoin(
      schema.dietaryRestrictions,
      eq(schema.userRestrictions.restrictionId, schema.dietaryRestrictions.id)
    )
    .where(eq(schema.userRestrictions.userId, userId));

  return c.json({
    success: true,
    data: {
      restrictions: userRestrictions,
    },
  });
});

/**
 * DELETE /users/me
 * Delete user account
 */
users.delete('/me', async (c) => {
  const userId = getCurrentUserId(c);
  const body = await c.req.json();
  const { password } = deleteAccountSchema.parse(body);

  // Verify password
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
  });

  if (!user || !user.passwordHash) {
    throw new HTTPException(400, {
      message: 'Cannot delete account',
      cause: { code: 'INVALID_REQUEST' },
    });
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) {
    throw new HTTPException(401, {
      message: 'Invalid password',
      cause: { code: 'AUTH_INVALID_CREDENTIALS' },
    });
  }

  // Delete user (cascades to related data)
  await db.delete(schema.users).where(eq(schema.users.id, userId));

  return c.body(null, 204);
});

/**
 * GET /users/restrictions
 * List available dietary restrictions
 */
users.get('/restrictions', async (c) => {
  const restrictions = await db.query.dietaryRestrictions.findMany({
    orderBy: (r, { asc }) => [asc(r.name)],
  });

  return c.json({
    success: true,
    data: restrictions,
  });
});

export default users;
