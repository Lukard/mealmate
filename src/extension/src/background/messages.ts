/**
 * Background Messages
 * Type-safe message handlers for communication between extension components
 */

import type { PlasmoMessaging } from '@plasmohq/messaging';

import { apiClient } from '~/lib/api';
import { groceryListStorage, settingsStorage, sessionStorage } from '~/lib/storage';
import { cartAutomation } from '~/lib/cart-automation';
import type {
  ExtensionSettings,
  StartCartFillPayload,
  CartAutomationSession
} from '~/types';
import type { GroceryList } from '@meal-automation/shared';

/**
 * Message request/response types
 */
export interface MessageTypes {
  'get-grocery-list': {
    request: void;
    response: {
      groceryList?: GroceryList;
      lastSynced?: Date;
      fromCache: boolean;
      stale?: boolean;
      error?: string;
    };
  };
  'sync-grocery-list': {
    request: void;
    response: {
      success: boolean;
      groceryList?: GroceryList;
      error?: string;
    };
  };
  'start-cart-fill': {
    request: StartCartFillPayload;
    response: {
      success: boolean;
      session?: CartAutomationSession;
      error?: string;
    };
  };
  'pause-cart-fill': {
    request: void;
    response: { success: boolean };
  };
  'resume-cart-fill': {
    request: void;
    response: { success: boolean };
  };
  'cancel-cart-fill': {
    request: void;
    response: { success: boolean };
  };
  'get-cart-status': {
    request: void;
    response: { session?: CartAutomationSession };
  };
  'get-settings': {
    request: void;
    response: { settings: ExtensionSettings };
  };
  'update-settings': {
    request: Partial<ExtensionSettings>;
    response: {
      success: boolean;
      settings: ExtensionSettings;
    };
  };
}

/**
 * Handler for getting grocery list
 */
export const getGroceryListHandler: PlasmoMessaging.MessageHandler<
  MessageTypes['get-grocery-list']['request'],
  MessageTypes['get-grocery-list']['response']
> = async (req, res) => {
  try {
    // First try to get from storage
    const cached = await groceryListStorage.get();
    const lastSync = await groceryListStorage.getLastSync();

    // If cache is fresh (less than 5 minutes old), return it
    if (cached && lastSync) {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      if (lastSync > fiveMinutesAgo) {
        res.send({
          groceryList: cached,
          lastSynced: lastSync,
          fromCache: true
        });
        return;
      }
    }

    // Otherwise, fetch from API
    const response = await apiClient.getActiveGroceryList();

    if (response.success && response.data) {
      await groceryListStorage.set(response.data.groceryList);
      res.send({
        groceryList: response.data.groceryList,
        lastSynced: response.data.lastSynced,
        fromCache: false
      });
      return;
    }

    // If API fails but we have cached data, return it
    if (cached) {
      res.send({
        groceryList: cached,
        lastSynced: lastSync ?? undefined,
        fromCache: true,
        stale: true
      });
      return;
    }

    res.send({
      fromCache: false,
      error: response.error ?? 'Failed to fetch grocery list'
    });
  } catch (error) {
    res.send({
      fromCache: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Handler for syncing grocery list
 */
export const syncGroceryListHandler: PlasmoMessaging.MessageHandler<
  MessageTypes['sync-grocery-list']['request'],
  MessageTypes['sync-grocery-list']['response']
> = async (req, res) => {
  try {
    const response = await apiClient.getActiveGroceryList();

    if (response.success && response.data) {
      await groceryListStorage.set(response.data.groceryList);
      res.send({
        success: true,
        groceryList: response.data.groceryList
      });
      return;
    }

    res.send({
      success: false,
      error: response.error ?? 'Failed to sync'
    });
  } catch (error) {
    res.send({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Handler for starting cart fill
 */
export const startCartFillHandler: PlasmoMessaging.MessageHandler<
  MessageTypes['start-cart-fill']['request'],
  MessageTypes['start-cart-fill']['response']
> = async (req, res) => {
  try {
    const { groceryListId, supermarket, items } = req.body;
    const session = await cartAutomation.start(supermarket, groceryListId, items);
    res.send({ success: true, session });
  } catch (error) {
    res.send({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start automation'
    });
  }
};

/**
 * Handler for pausing cart fill
 */
export const pauseCartFillHandler: PlasmoMessaging.MessageHandler<
  MessageTypes['pause-cart-fill']['request'],
  MessageTypes['pause-cart-fill']['response']
> = async (req, res) => {
  await cartAutomation.pause();
  res.send({ success: true });
};

/**
 * Handler for resuming cart fill
 */
export const resumeCartFillHandler: PlasmoMessaging.MessageHandler<
  MessageTypes['resume-cart-fill']['request'],
  MessageTypes['resume-cart-fill']['response']
> = async (req, res) => {
  await cartAutomation.resume();
  res.send({ success: true });
};

/**
 * Handler for canceling cart fill
 */
export const cancelCartFillHandler: PlasmoMessaging.MessageHandler<
  MessageTypes['cancel-cart-fill']['request'],
  MessageTypes['cancel-cart-fill']['response']
> = async (req, res) => {
  await cartAutomation.cancel();
  res.send({ success: true });
};

/**
 * Handler for getting cart status
 */
export const getCartStatusHandler: PlasmoMessaging.MessageHandler<
  MessageTypes['get-cart-status']['request'],
  MessageTypes['get-cart-status']['response']
> = async (req, res) => {
  const session = cartAutomation.getSession() ?? await sessionStorage.getCurrent();
  res.send({ session: session ?? undefined });
};

/**
 * Handler for getting settings
 */
export const getSettingsHandler: PlasmoMessaging.MessageHandler<
  MessageTypes['get-settings']['request'],
  MessageTypes['get-settings']['response']
> = async (req, res) => {
  const settings = await settingsStorage.get();
  res.send({ settings });
};

/**
 * Handler for updating settings
 */
export const updateSettingsHandler: PlasmoMessaging.MessageHandler<
  MessageTypes['update-settings']['request'],
  MessageTypes['update-settings']['response']
> = async (req, res) => {
  const settings = await settingsStorage.update(req.body);
  res.send({ success: true, settings });
};
