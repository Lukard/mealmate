/**
 * Playwright Global Teardown
 *
 * Runs once after all tests complete. Used to:
 * - Clean up test data
 * - Close connections
 * - Generate reports
 */

import { FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

async function globalTeardown(config: FullConfig) {
  console.log('Starting global teardown...');

  // Clean up authentication state
  const storageDir = path.join(__dirname, '../../.auth');
  if (fs.existsSync(storageDir)) {
    try {
      fs.rmSync(storageDir, { recursive: true, force: true });
      console.log('Cleaned up authentication state');
    } catch (error) {
      console.log('Could not clean up auth state:', error);
    }
  }

  // Clean up test database (if applicable)
  // In a real implementation, this would drop test data or reset the database
  console.log('Cleaning up test database...');

  // Log test artifacts location
  console.log(`Test artifacts saved to: ${config.projects[0]?.outputDir || 'test-results/'}`);

  // Generate summary report
  const reportPath = path.join(process.cwd(), 'test-results.json');
  if (fs.existsSync(reportPath)) {
    try {
      const results = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
      console.log('\n========== E2E Test Summary ==========');
      console.log(`Total: ${results.stats?.total || 'N/A'}`);
      console.log(`Passed: ${results.stats?.passed || 'N/A'}`);
      console.log(`Failed: ${results.stats?.failed || 'N/A'}`);
      console.log(`Skipped: ${results.stats?.skipped || 'N/A'}`);
      console.log(`Duration: ${results.stats?.duration || 'N/A'}ms`);
      console.log('=======================================\n');
    } catch {
      console.log('Could not parse test results');
    }
  }

  console.log('Global teardown completed');
}

export default globalTeardown;
