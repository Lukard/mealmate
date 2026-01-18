/**
 * Background Service Worker
 * Handles message passing and coordination between popup and content scripts
 */

import { apiClient } from '~/lib/api';
import { groceryListStorage, settingsStorage, sessionStorage } from '~/lib/storage';
import { cartAutomation } from '~/lib/cart-automation';
import type {
  ExtensionMessage,
  ExtensionMessageType,
  StartCartFillPayload,
  ExtensionSettings,
  CartAutomationSession
} from '~/types';

/**
 * Message handler type
 */
type MessageHandler<T = unknown, R = unknown> = (
  payload: T,
  sender: chrome.runtime.MessageSender
) => Promise<R>;

/**
 * Message handlers map
 */
const messageHandlers: Partial<Record<ExtensionMessageType, MessageHandler>> = {
  /**
   * Get the current grocery list
   */
  GET_GROCERY_LIST: async () => {
    // First try to get from storage
    const cached = await groceryListStorage.get();
    const lastSync = await groceryListStorage.getLastSync();

    // If cache is fresh (less than 5 minutes old), return it
    if (cached && lastSync) {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      if (lastSync > fiveMinutesAgo) {
        return { groceryList: cached, lastSynced: lastSync, fromCache: true };
      }
    }

    // Otherwise, fetch from API
    const response = await apiClient.getActiveGroceryList();

    if (response.success && response.data) {
      await groceryListStorage.set(response.data.groceryList);
      return { ...response.data, fromCache: false };
    }

    // If API fails but we have cached data, return it
    if (cached) {
      return { groceryList: cached, lastSynced: lastSync, fromCache: true, stale: true };
    }

    return { error: response.error ?? 'Failed to fetch grocery list' };
  },

  /**
   * Sync grocery list from backend
   */
  SYNC_GROCERY_LIST: async () => {
    const response = await apiClient.getActiveGroceryList();

    if (response.success && response.data) {
      await groceryListStorage.set(response.data.groceryList);
      return { success: true, groceryList: response.data.groceryList };
    }

    return { success: false, error: response.error };
  },

  /**
   * Start cart fill automation
   */
  START_CART_FILL: async (payload: StartCartFillPayload) => {
    const { groceryListId, supermarket, items } = payload;

    try {
      const session = await cartAutomation.start(supermarket, groceryListId, items);
      return { success: true, session };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start automation'
      };
    }
  },

  /**
   * Pause cart fill automation
   */
  PAUSE_CART_FILL: async () => {
    await cartAutomation.pause();
    return { success: true };
  },

  /**
   * Resume cart fill automation
   */
  RESUME_CART_FILL: async () => {
    await cartAutomation.resume();
    return { success: true };
  },

  /**
   * Cancel cart fill automation
   */
  CANCEL_CART_FILL: async () => {
    await cartAutomation.cancel();
    return { success: true };
  },

  /**
   * Get current cart status
   */
  GET_CART_STATUS: async () => {
    const session = cartAutomation.getSession() ?? await sessionStorage.getCurrent();
    return { session };
  },

  /**
   * Get extension settings
   */
  GET_SETTINGS: async () => {
    const settings = await settingsStorage.get();
    return { settings };
  },

  /**
   * Update extension settings
   */
  UPDATE_SETTINGS: async (payload: Partial<ExtensionSettings>) => {
    const settings = await settingsStorage.update(payload);
    return { success: true, settings };
  }
};

/**
 * Listen for messages from popup and content scripts
 */
chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void
  ) => {
    const { type, payload } = message;

    const handler = messageHandlers[type];
    if (!handler) {
      console.warn(`[Background] Unknown message type: ${type}`);
      sendResponse({ error: `Unknown message type: ${type}` });
      return false;
    }

    // Handle async response
    handler(payload, sender)
      .then(sendResponse)
      .catch((error) => {
        console.error(`[Background] Error handling ${type}:`, error);
        sendResponse({ error: error.message });
      });

    // Return true to indicate we'll send a response asynchronously
    return true;
  }
);

/**
 * Handle extension installation/update
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Background] Extension installed/updated:', details.reason);

  if (details.reason === 'install') {
    // Initialize default settings
    await settingsStorage.set({
      autoFillEnabled: false,
      defaultSupermarket: 'mercadona',
      showNotifications: true,
      autoSelectBestPrice: true,
      preferStoreBrands: false,
      apiEndpoint: 'http://localhost:3000/api',
      theme: 'system'
    });
  }
});

/**
 * Handle tab updates to inject content scripts when needed
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;

  const supermarketUrls = [
    { pattern: 'dia.es', supermarket: 'dia' },
    { pattern: 'mercadona.es', supermarket: 'mercadona' },
    { pattern: 'carrefour.es', supermarket: 'carrefour_es' }
  ];

  const matchedSupermarket = supermarketUrls.find((s) =>
    tab.url?.includes(s.pattern)
  );

  if (matchedSupermarket) {
    console.log(`[Background] Detected ${matchedSupermarket.supermarket} page:`, tab.url);
  }
});

/**
 * Keep service worker alive
 */
chrome.alarms.create('keepAlive', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    console.log('[Background] Keep alive ping');
  }
});

console.log('[Background] Service worker initialized');
