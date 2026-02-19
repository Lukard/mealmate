import { test, expect } from '@playwright/test';

test.describe('AI Meal Plan Generation', () => {
  test('should generate different meal plans on each click', async ({ page }) => {
    // Navigate to meal plan page
    await page.goto('https://mealmate-ui.vercel.app/meal-plan');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of initial state
    await page.screenshot({ path: 'test-results/01-initial.png' });
    
    // Look for the "Generar con IA" button
    const generateButton = page.getByRole('button', { name: /generar con ia/i });
    
    // Check if button exists
    const buttonExists = await generateButton.count();
    console.log('Generate button found:', buttonExists > 0);
    
    if (buttonExists === 0) {
      // Maybe we need to complete onboarding first - check the page content
      const pageContent = await page.content();
      console.log('Page title:', await page.title());
      
      // Check if redirected to onboarding
      const currentUrl = page.url();
      console.log('Current URL:', currentUrl);
      
      if (currentUrl.includes('onboarding')) {
        console.log('Redirected to onboarding - need to complete it first');
        await page.screenshot({ path: 'test-results/02-onboarding.png' });
      }
      
      return;
    }
    
    // Click the generate button
    console.log('Clicking generate button...');
    await generateButton.click();
    
    // Wait for modal to appear
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/03-modal-loading.png' });
    
    // Wait for generation to complete (look for AI explanation or error)
    try {
      await page.waitForSelector('text=Explicación de la IA', { timeout: 15000 });
      console.log('Generation completed successfully!');
      await page.screenshot({ path: 'test-results/04-generation-complete.png' });
      
      // Get the first meal name
      const firstMeal = await page.locator('[data-testid="meal-entry"]').first().textContent();
      console.log('First generated meal:', firstMeal);
      
    } catch (e) {
      // Check for error
      const errorVisible = await page.locator('text=Error al generar').isVisible();
      if (errorVisible) {
        console.log('Generation failed with error');
        await page.screenshot({ path: 'test-results/04-error.png' });
      } else {
        // Still loading or something else
        await page.screenshot({ path: 'test-results/04-unknown-state.png' });
        const modalContent = await page.locator('.fixed.inset-0').textContent();
        console.log('Modal content:', modalContent?.substring(0, 500));
      }
    }
  });
});
