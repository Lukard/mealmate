/**
 * Extension Library Index
 * Re-exports all library modules
 */

export { apiClient } from './api';
export type { ApiClient } from './api';

export {
  settingsStorage,
  groceryListStorage,
  sessionStorage,
  clearAllData,
  exportAllData
} from './storage';

export {
  CartAutomationController,
  cartAutomation,
  createSession
} from './cart-automation';

export {
  formatPrice,
  formatRelativeTime,
  debounce,
  throttle,
  sleep,
  retry,
  isContentScript,
  isBackgroundWorker,
  generateId,
  safeJsonParse,
  deepClone,
  detectSupermarket,
  normalizeProductName,
  textSimilarity
} from './utils';
