/**
 * Cart Automation Logic
 * Orchestrates the process of filling a supermarket cart
 */

import type { GroceryItem } from '@meal-automation/shared';
import type {
  CartAutomationSession,
  CartItemResult,
  CartItemStatus,
  SupportedSupermarket,
  AddItemToCartPayload,
  AddItemResponse
} from '~/types';
import { sessionStorage } from './storage';
import { apiClient } from './api';

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a new cart automation session
 */
export function createSession(
  supermarket: SupportedSupermarket,
  groceryListId: string,
  items: readonly GroceryItem[]
): CartAutomationSession {
  return {
    id: generateSessionId(),
    supermarket,
    groceryListId,
    status: 'idle',
    totalItems: items.length,
    completedItems: 0,
    failedItems: 0,
    results: items.map((item) => ({
      groceryItemId: item.id,
      ingredientName: item.ingredientName,
      status: 'pending' as CartItemStatus,
      quantity: item.totalQuantity,
      timestamp: new Date()
    })),
    totalSpent: 0
  };
}

/**
 * Cart Automation Controller
 * Manages the automation process and communicates with content scripts
 */
export class CartAutomationController {
  private session: CartAutomationSession | null = null;
  private isPaused: boolean = false;
  private currentItemIndex: number = 0;
  private tabId: number | null = null;

  /**
   * Start a new cart automation session
   */
  async start(
    supermarket: SupportedSupermarket,
    groceryListId: string,
    items: readonly GroceryItem[]
  ): Promise<CartAutomationSession> {
    // Create new session
    this.session = createSession(supermarket, groceryListId, items);
    this.session = {
      ...this.session,
      status: 'running',
      startTime: new Date()
    };

    // Save to storage
    await sessionStorage.setCurrent(this.session);

    // Log session start to backend
    await apiClient.logSessionStart(groceryListId, supermarket);

    // Open supermarket tab
    await this.openSupermarketTab(supermarket);

    // Start processing items
    this.currentItemIndex = 0;
    this.isPaused = false;
    this.processNextItem();

    return this.session;
  }

  /**
   * Pause the automation
   */
  async pause(): Promise<void> {
    this.isPaused = true;
    if (this.session) {
      this.session = {
        ...this.session,
        status: 'paused'
      };
      await sessionStorage.setCurrent(this.session);
    }
  }

  /**
   * Resume the automation
   */
  async resume(): Promise<void> {
    this.isPaused = false;
    if (this.session) {
      this.session = {
        ...this.session,
        status: 'running'
      };
      await sessionStorage.setCurrent(this.session);
      this.processNextItem();
    }
  }

  /**
   * Cancel the automation
   */
  async cancel(): Promise<void> {
    this.isPaused = true;
    if (this.session) {
      this.session = {
        ...this.session,
        status: 'completed',
        endTime: new Date()
      };
      await sessionStorage.clearCurrent();
    }
    this.session = null;
  }

  /**
   * Get current session status
   */
  getSession(): CartAutomationSession | null {
    return this.session;
  }

  /**
   * Open the supermarket website in a new tab
   */
  private async openSupermarketTab(supermarket: SupportedSupermarket): Promise<void> {
    const urls: Record<SupportedSupermarket, string> = {
      dia: 'https://www.dia.es',
      mercadona: 'https://tienda.mercadona.es',
      carrefour_es: 'https://www.carrefour.es'
    };

    const tab = await chrome.tabs.create({ url: urls[supermarket], active: true });
    this.tabId = tab.id ?? null;

    // Wait for page to load
    await this.waitForTabLoad(this.tabId);
  }

  /**
   * Wait for a tab to finish loading
   */
  private waitForTabLoad(tabId: number | null): Promise<void> {
    return new Promise((resolve) => {
      if (!tabId) {
        resolve();
        return;
      }

      const listener = (
        updatedTabId: number,
        changeInfo: chrome.tabs.TabChangeInfo
      ) => {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          // Give the page a bit more time to fully render
          setTimeout(resolve, 1500);
        }
      };

      chrome.tabs.onUpdated.addListener(listener);

      // Timeout after 30 seconds
      setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }, 30000);
    });
  }

  /**
   * Process the next item in the queue
   */
  private async processNextItem(): Promise<void> {
    if (!this.session || this.isPaused || this.currentItemIndex >= this.session.results.length) {
      await this.completeSession();
      return;
    }

    const currentResult = this.session.results[this.currentItemIndex];

    // Update status to searching
    await this.updateItemStatus(this.currentItemIndex, {
      status: 'searching',
      timestamp: new Date()
    });

    try {
      // Send message to content script to add item
      const payload: AddItemToCartPayload = {
        searchQuery: currentResult.ingredientName,
        quantity: currentResult.quantity,
        groceryItemId: currentResult.groceryItemId
      };

      const response = await this.sendToContentScript<AddItemResponse>('ADD_ITEM_TO_CART', payload);

      if (response.success) {
        await this.updateItemStatus(this.currentItemIndex, {
          status: 'added',
          matchedProductName: response.productName,
          matchedProductPrice: response.productPrice,
          timestamp: new Date()
        });

        // Update total spent
        if (response.productPrice && this.session) {
          this.session = {
            ...this.session,
            completedItems: this.session.completedItems + 1,
            totalSpent: this.session.totalSpent + (response.productPrice * currentResult.quantity)
          };
          await sessionStorage.setCurrent(this.session);
        }
      } else {
        await this.updateItemStatus(this.currentItemIndex, {
          status: 'not_found',
          errorMessage: response.errorMessage,
          timestamp: new Date()
        });

        if (this.session) {
          this.session = {
            ...this.session,
            failedItems: this.session.failedItems + 1
          };
          await sessionStorage.setCurrent(this.session);
        }
      }
    } catch (error) {
      await this.updateItemStatus(this.currentItemIndex, {
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      });

      if (this.session) {
        this.session = {
          ...this.session,
          failedItems: this.session.failedItems + 1
        };
        await sessionStorage.setCurrent(this.session);
      }
    }

    // Move to next item
    this.currentItemIndex++;

    // Add delay between items to avoid rate limiting
    await this.delay(2000);

    // Process next item
    this.processNextItem();
  }

  /**
   * Update the status of an item
   */
  private async updateItemStatus(
    index: number,
    update: Partial<CartItemResult>
  ): Promise<void> {
    if (!this.session) return;

    const results = [...this.session.results];
    results[index] = {
      ...results[index],
      ...update
    } as CartItemResult;

    this.session = {
      ...this.session,
      results
    };

    await sessionStorage.setCurrent(this.session);
  }

  /**
   * Send a message to the content script
   */
  private async sendToContentScript<T>(
    type: string,
    payload: unknown
  ): Promise<T> {
    if (!this.tabId) {
      throw new Error('No active tab');
    }

    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(
        this.tabId!,
        { type, payload },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response as T);
          }
        }
      );
    });
  }

  /**
   * Complete the session
   */
  private async completeSession(): Promise<void> {
    if (!this.session) return;

    this.session = {
      ...this.session,
      status: 'completed',
      endTime: new Date()
    };

    // Log to backend
    await apiClient.logSessionComplete(this.session.id, {
      totalItems: this.session.totalItems,
      completedItems: this.session.completedItems,
      failedItems: this.session.failedItems,
      totalSpent: this.session.totalSpent
    });

    // Sync added items
    const addedItems = this.session.results
      .filter((r) => r.status === 'added')
      .map((r) => ({
        itemId: r.groceryItemId,
        productName: r.matchedProductName ?? r.ingredientName,
        price: r.matchedProductPrice ?? 0,
        quantity: r.quantity
      }));

    if (addedItems.length > 0) {
      await apiClient.syncCartAdditions(this.session.groceryListId, addedItems);
    }

    await sessionStorage.clearCurrent();
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const cartAutomation = new CartAutomationController();
