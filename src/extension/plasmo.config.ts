/**
 * Plasmo Configuration
 * Configuration for the Plasmo browser extension framework
 *
 * MealMate - Grocery Cart Automation for Spanish Supermarkets
 */

import type { PlasmoConfig } from 'plasmo';

const config: PlasmoConfig = {
  // Overrides for manifest generation
  manifest: {
    // Use i18n message references for Chrome Web Store
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    version: '1.0.0',
    default_locale: 'es',

    // Extension icons
    icons: {
      '16': 'assets/icon16.png',
      '48': 'assets/icon48.png',
      '128': 'assets/icon128.png'
    },

    // Browser action (toolbar icon)
    action: {
      default_icon: {
        '16': 'assets/icon16.png',
        '48': 'assets/icon48.png'
      },
      default_title: 'MealMate'
    },

    // Required permissions
    permissions: [
      'storage',      // Save grocery lists and settings
      'activeTab',    // Interact with current tab
      'scripting',    // Inject content scripts
      'tabs',         // Detect supermarket tabs
      'alarms'        // Background sync scheduling
    ],

    // Host permissions for supported supermarkets
    host_permissions: [
      'https://www.dia.es/*',
      'https://dia.es/*',
      'https://tienda.mercadona.es/*',
      'https://www.mercadona.es/*',
      'https://www.carrefour.es/*',
      'http://localhost:3000/*'  // Development backend
    ],

    // Content Security Policy
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'"
    },

    // Minimum Chrome version (Manifest V3 requirement)
    minimum_chrome_version: '88'
  }
};

export default config;
