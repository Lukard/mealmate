/**
 * E2E Tests: Meal Planning Flow
 *
 * Tests the complete user journey from meal planning to grocery list generation.
 */

import { test, expect, Page } from '@playwright/test';

// ============================================================================
// Test Fixtures
// ============================================================================

const testUser = {
  email: 'e2e-test@example.com',
  password: 'TestPassword123!',
  name: 'E2E Test User',
};

const mealPlanConfig = {
  dietType: 'standard',
  targetCalories: 2000,
  mealsPerDay: 3,
  days: 7,
};

// ============================================================================
// Helper Functions
// ============================================================================

async function login(page: Page) {
  await page.goto('/login');
  await page.fill('[data-testid="email-input"]', testUser.email);
  await page.fill('[data-testid="password-input"]', testUser.password);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
}

async function navigateToMealPlanning(page: Page) {
  await page.click('[data-testid="nav-meal-planning"]');
  await page.waitForURL('**/meal-planning');
}

// ============================================================================
// Tests
// ============================================================================

test.describe('Meal Planning Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Skip login if auth state is loaded
    // In real tests, use storageState from global setup
  });

  test('should display meal planning questionnaire', async ({ page }) => {
    await page.goto('/meal-planning/new');

    // Check questionnaire elements are visible
    await expect(page.locator('[data-testid="diet-type-select"]')).toBeVisible();
    await expect(page.locator('[data-testid="calories-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="meals-per-day-select"]')).toBeVisible();
    await expect(page.locator('[data-testid="allergies-select"]')).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    await page.goto('/meal-planning/new');

    // Try to submit without filling required fields
    await page.click('[data-testid="generate-plan-button"]');

    // Should show validation errors
    await expect(page.locator('[data-testid="error-diet-type"]')).toBeVisible();
  });

  test('should generate meal plan with standard preferences', async ({ page }) => {
    await page.goto('/meal-planning/new');

    // Fill out questionnaire
    await page.selectOption('[data-testid="diet-type-select"]', mealPlanConfig.dietType);
    await page.fill('[data-testid="calories-input"]', mealPlanConfig.targetCalories.toString());
    await page.selectOption('[data-testid="meals-per-day-select"]', mealPlanConfig.mealsPerDay.toString());
    await page.selectOption('[data-testid="plan-duration-select"]', mealPlanConfig.days.toString());

    // Generate plan
    await page.click('[data-testid="generate-plan-button"]');

    // Wait for plan generation
    await page.waitForSelector('[data-testid="meal-plan-view"]', { timeout: 30000 });

    // Verify plan is displayed
    await expect(page.locator('[data-testid="meal-plan-view"]')).toBeVisible();
    await expect(page.locator('[data-testid="day-1-meals"]')).toBeVisible();
  });

  test('should allow editing generated meal plan', async ({ page }) => {
    await page.goto('/meal-planning/new');

    // Generate a quick plan (assuming mock API)
    await page.selectOption('[data-testid="diet-type-select"]', 'standard');
    await page.click('[data-testid="generate-plan-button"]');
    await page.waitForSelector('[data-testid="meal-plan-view"]');

    // Click edit on a meal
    await page.click('[data-testid="edit-meal-day-1-lunch"]');

    // Modal should appear
    await expect(page.locator('[data-testid="edit-meal-modal"]')).toBeVisible();

    // Change the meal
    await page.click('[data-testid="meal-option-alternative"]');
    await page.click('[data-testid="save-meal-changes"]');

    // Verify change was applied
    await expect(page.locator('[data-testid="meal-updated-indicator"]')).toBeVisible();
  });

  test('should generate grocery list from meal plan', async ({ page }) => {
    await page.goto('/meal-planning/new');

    // Generate plan
    await page.selectOption('[data-testid="diet-type-select"]', 'standard');
    await page.click('[data-testid="generate-plan-button"]');
    await page.waitForSelector('[data-testid="meal-plan-view"]');

    // Generate grocery list
    await page.click('[data-testid="generate-grocery-list-button"]');

    // Wait for grocery list page
    await page.waitForURL('**/grocery-list/**', { timeout: 15000 });

    // Verify grocery list is displayed
    await expect(page.locator('[data-testid="grocery-list-view"]')).toBeVisible();
    await expect(page.locator('[data-testid="grocery-item"]').first()).toBeVisible();
  });

  test('should display nutritional summary', async ({ page }) => {
    await page.goto('/meal-planning/new');

    // Generate plan
    await page.selectOption('[data-testid="diet-type-select"]', 'standard');
    await page.fill('[data-testid="calories-input"]', '2000');
    await page.click('[data-testid="generate-plan-button"]');
    await page.waitForSelector('[data-testid="meal-plan-view"]');

    // Open nutrition summary
    await page.click('[data-testid="view-nutrition-summary"]');

    // Verify summary is displayed
    await expect(page.locator('[data-testid="nutrition-summary"]')).toBeVisible();
    await expect(page.locator('[data-testid="average-calories"]')).toBeVisible();
    await expect(page.locator('[data-testid="macro-breakdown"]')).toBeVisible();
  });
});

test.describe('Dietary Restrictions', () => {
  test('should handle vegetarian diet correctly', async ({ page }) => {
    await page.goto('/meal-planning/new');

    // Select vegetarian diet
    await page.selectOption('[data-testid="diet-type-select"]', 'vegetarian');
    await page.click('[data-testid="generate-plan-button"]');
    await page.waitForSelector('[data-testid="meal-plan-view"]');

    // Verify no meat products in plan
    const mealCards = page.locator('[data-testid^="meal-card-"]');
    const mealCount = await mealCards.count();

    for (let i = 0; i < mealCount; i++) {
      const mealText = await mealCards.nth(i).textContent();
      expect(mealText?.toLowerCase()).not.toContain('pollo');
      expect(mealText?.toLowerCase()).not.toContain('carne');
      expect(mealText?.toLowerCase()).not.toContain('ternera');
    }
  });

  test('should handle allergy selections', async ({ page }) => {
    await page.goto('/meal-planning/new');

    // Select diet and add allergies
    await page.selectOption('[data-testid="diet-type-select"]', 'standard');
    await page.click('[data-testid="allergies-select"]');
    await page.click('[data-testid="allergy-option-nuts"]');
    await page.click('[data-testid="allergy-option-shellfish"]');

    await page.click('[data-testid="generate-plan-button"]');
    await page.waitForSelector('[data-testid="meal-plan-view"]');

    // Verify allergen warning is visible
    await expect(page.locator('[data-testid="allergen-filtered-notice"]')).toBeVisible();
  });

  test('should warn about potential allergens', async ({ page }) => {
    await page.goto('/meal-planning/existing-plan-123');

    // If a plan has potential allergens, should show warning
    const allergenWarning = page.locator('[data-testid="allergen-warning"]');
    if (await allergenWarning.isVisible()) {
      await expect(allergenWarning).toContainText('Revisar ingredientes');
    }
  });
});

test.describe('Responsive Design', () => {
  test('should work on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/meal-planning/new');

    // Navigation should be in mobile menu
    await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();

    // Form should be stacked vertically
    await expect(page.locator('[data-testid="diet-type-select"]')).toBeVisible();

    // Generate plan on mobile
    await page.selectOption('[data-testid="diet-type-select"]', 'standard');
    await page.click('[data-testid="generate-plan-button"]');
    await page.waitForSelector('[data-testid="meal-plan-view"]');

    // Days should be in carousel or accordion on mobile
    await expect(page.locator('[data-testid="mobile-day-selector"]')).toBeVisible();
  });

  test('should work on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/meal-planning/new');

    // Should show 2-column layout
    const layout = page.locator('[data-testid="meal-plan-grid"]');
    if (await layout.isVisible()) {
      const gridStyle = await layout.evaluate((el) =>
        window.getComputedStyle(el).getPropertyValue('grid-template-columns')
      );
      expect(gridStyle).toContain('repeat');
    }
  });
});

test.describe('Error Handling', () => {
  test('should handle network errors gracefully', async ({ page }) => {
    // Simulate offline
    await page.route('**/api/**', (route) => route.abort('failed'));

    await page.goto('/meal-planning/new');
    await page.selectOption('[data-testid="diet-type-select"]', 'standard');
    await page.click('[data-testid="generate-plan-button"]');

    // Should show error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
  });

  test('should handle server errors gracefully', async ({ page }) => {
    // Simulate 500 error
    await page.route('**/api/meal-plans/generate', (route) =>
      route.fulfill({ status: 500, body: 'Internal Server Error' })
    );

    await page.goto('/meal-planning/new');
    await page.selectOption('[data-testid="diet-type-select"]', 'standard');
    await page.click('[data-testid="generate-plan-button"]');

    // Should show user-friendly error
    await expect(page.locator('[data-testid="error-message"]')).toContainText(
      'Error al generar el plan'
    );
  });
});
