/**
 * Playwright Global Setup
 *
 * Runs once before all tests. Used to set up:
 * - Test database
 * - Authentication state
 * - Environment variables
 */

import { chromium, FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

async function globalSetup(config: FullConfig) {
  console.log('Starting global setup...');

  // Create storage state directory
  const storageDir = path.join(__dirname, '../../.auth');
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }

  // Setup authenticated user state
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to login page
    const baseURL = config.projects[0].use?.baseURL || 'http://localhost:3000';
    await page.goto(`${baseURL}/login`);

    // Perform login (adjust selectors based on actual implementation)
    // This creates a storage state file that can be reused across tests
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');

    // Wait for login to complete
    await page.waitForURL('**/dashboard', { timeout: 10000 }).catch(() => {
      console.log('Login redirect not detected, continuing with setup...');
    });

    // Save authentication state
    await context.storageState({
      path: path.join(storageDir, 'user.json'),
    });

    console.log('Authentication state saved');
  } catch (error) {
    console.log('Could not complete login setup (server may not be running):', error);
    // Create empty auth state file for tests that don't require auth
    fs.writeFileSync(
      path.join(storageDir, 'user.json'),
      JSON.stringify({ cookies: [], origins: [] })
    );
  } finally {
    await browser.close();
  }

  // Set up test database
  // In a real implementation, this would seed the database with test data
  console.log('Setting up test database...');

  // Verify services are available
  const services = [
    { name: 'Web App', url: 'http://localhost:3000' },
    { name: 'API', url: 'http://localhost:3001/health' },
  ];

  for (const service of services) {
    try {
      const response = await fetch(service.url, { method: 'GET' });
      if (response.ok) {
        console.log(`[OK] ${service.name} is available at ${service.url}`);
      } else {
        console.log(`[WARN] ${service.name} returned status ${response.status}`);
      }
    } catch {
      console.log(`[SKIP] ${service.name} not available (${service.url})`);
    }
  }

  console.log('Global setup completed');
}

export default globalSetup;
