/**
 * MSW Server Setup for Node.js Tests
 *
 * This file configures the MSW server for use in unit and integration tests.
 */

import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// Create the MSW server with default handlers
export const server = setupServer(...handlers);

// Re-export handlers for easy access
export { handlers } from './handlers';
