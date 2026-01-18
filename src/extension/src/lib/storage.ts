/**
 * Chrome Storage Wrapper
 * Provides typed access to browser storage
 */

import { Storage } from '@plasmohq/storage';

import type {
  CartAutomationSession,
  ExtensionSettings,
  DEFAULT_EXTENSION_SETTINGS
} from '~/types';

import type { GroceryList } from '@meal-automation/shared';

// Create storage instances
const localStorage = new Storage({ area: 'local' });
const syncStorage = new Storage({ area: 'sync' });

/**
 * Storage keys
 */
const STORAGE_KEYS = {
  SETTINGS: 'settings',
  GROCERY_LIST: 'groceryList',
  CURRENT_SESSION: 'currentSession',
  SESSION_HISTORY: 'sessionHistory',
  LAST_SYNC: 'lastSync'
} as const;

/**
 * Settings Storage
 */
export const settingsStorage = {
  async get(): Promise<ExtensionSettings> {
    const settings = await syncStorage.get<ExtensionSettings>(STORAGE_KEYS.SETTINGS);
    return settings ?? {
      autoFillEnabled: false,
      defaultSupermarket: 'mercadona',
      showNotifications: true,
      autoSelectBestPrice: true,
      preferStoreBrands: false,
      apiEndpoint: 'http://localhost:3000/api',
      theme: 'system'
    };
  },

  async set(settings: ExtensionSettings): Promise<void> {
    await syncStorage.set(STORAGE_KEYS.SETTINGS, settings);
  },

  async update(partial: Partial<ExtensionSettings>): Promise<ExtensionSettings> {
    const current = await this.get();
    const updated = { ...current, ...partial };
    await this.set(updated);
    return updated;
  },

  watch(callback: (settings: ExtensionSettings) => void): () => void {
    return syncStorage.watch({
      [STORAGE_KEYS.SETTINGS]: (change) => {
        if (change.newValue) {
          callback(change.newValue as ExtensionSettings);
        }
      }
    });
  }
};

/**
 * Grocery List Storage
 */
export const groceryListStorage = {
  async get(): Promise<GroceryList | null> {
    return localStorage.get<GroceryList>(STORAGE_KEYS.GROCERY_LIST);
  },

  async set(groceryList: GroceryList): Promise<void> {
    await localStorage.set(STORAGE_KEYS.GROCERY_LIST, groceryList);
    await localStorage.set(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
  },

  async clear(): Promise<void> {
    await localStorage.remove(STORAGE_KEYS.GROCERY_LIST);
  },

  async getLastSync(): Promise<Date | null> {
    const lastSync = await localStorage.get<string>(STORAGE_KEYS.LAST_SYNC);
    return lastSync ? new Date(lastSync) : null;
  },

  watch(callback: (groceryList: GroceryList | null) => void): () => void {
    return localStorage.watch({
      [STORAGE_KEYS.GROCERY_LIST]: (change) => {
        callback(change.newValue as GroceryList | null);
      }
    });
  }
};

/**
 * Session Storage
 */
export const sessionStorage = {
  async getCurrent(): Promise<CartAutomationSession | null> {
    return localStorage.get<CartAutomationSession>(STORAGE_KEYS.CURRENT_SESSION);
  },

  async setCurrent(session: CartAutomationSession): Promise<void> {
    await localStorage.set(STORAGE_KEYS.CURRENT_SESSION, session);
  },

  async updateCurrent(partial: Partial<CartAutomationSession>): Promise<CartAutomationSession | null> {
    const current = await this.getCurrent();
    if (!current) return null;

    const updated = { ...current, ...partial };
    await this.setCurrent(updated);
    return updated;
  },

  async clearCurrent(): Promise<void> {
    const current = await this.getCurrent();
    if (current) {
      await this.addToHistory(current);
    }
    await localStorage.remove(STORAGE_KEYS.CURRENT_SESSION);
  },

  async getHistory(): Promise<readonly CartAutomationSession[]> {
    const history = await localStorage.get<CartAutomationSession[]>(STORAGE_KEYS.SESSION_HISTORY);
    return history ?? [];
  },

  async addToHistory(session: CartAutomationSession): Promise<void> {
    const history = await this.getHistory();
    const updated = [session, ...history].slice(0, 20); // Keep last 20 sessions
    await localStorage.set(STORAGE_KEYS.SESSION_HISTORY, updated);
  },

  async clearHistory(): Promise<void> {
    await localStorage.set(STORAGE_KEYS.SESSION_HISTORY, []);
  },

  watch(callback: (session: CartAutomationSession | null) => void): () => void {
    return localStorage.watch({
      [STORAGE_KEYS.CURRENT_SESSION]: (change) => {
        callback(change.newValue as CartAutomationSession | null);
      }
    });
  }
};

/**
 * Clear all extension data
 */
export async function clearAllData(): Promise<void> {
  await Promise.all([
    localStorage.clear(),
    syncStorage.clear()
  ]);
}

/**
 * Export storage for debugging
 */
export async function exportAllData(): Promise<{
  settings: ExtensionSettings;
  groceryList: GroceryList | null;
  currentSession: CartAutomationSession | null;
  sessionHistory: readonly CartAutomationSession[];
}> {
  const [settings, groceryList, currentSession, sessionHistory] = await Promise.all([
    settingsStorage.get(),
    groceryListStorage.get(),
    sessionStorage.getCurrent(),
    sessionStorage.getHistory()
  ]);

  return {
    settings,
    groceryList,
    currentSession,
    sessionHistory
  };
}
