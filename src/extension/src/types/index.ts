/**
 * Extension Types
 * Type definitions specific to the browser extension
 */

import type { GroceryItem, GroceryList, SupermarketId } from '@meal-automation/shared';

/**
 * Supported supermarket identifiers for cart automation
 */
export type SupportedSupermarket = 'dia' | 'mercadona' | 'carrefour_es';

/**
 * Supermarket configuration for content scripts
 */
export interface SupermarketConfig {
  readonly id: SupportedSupermarket;
  readonly displayName: string;
  readonly baseUrl: string;
  readonly searchUrl: string;
  readonly logoUrl: string;
  readonly isSupported: boolean;
}

/**
 * Status of a cart item addition
 */
export type CartItemStatus =
  | 'pending'
  | 'searching'
  | 'found'
  | 'adding'
  | 'added'
  | 'not_found'
  | 'out_of_stock'
  | 'error';

/**
 * Result of adding an item to cart
 */
export interface CartItemResult {
  readonly groceryItemId: string;
  readonly ingredientName: string;
  readonly status: CartItemStatus;
  readonly matchedProductName?: string;
  readonly matchedProductPrice?: number;
  readonly quantity: number;
  readonly errorMessage?: string;
  readonly timestamp: Date;
}

/**
 * Overall cart automation session
 */
export interface CartAutomationSession {
  readonly id: string;
  readonly supermarket: SupportedSupermarket;
  readonly groceryListId: string;
  readonly status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  readonly totalItems: number;
  readonly completedItems: number;
  readonly failedItems: number;
  readonly results: readonly CartItemResult[];
  readonly startTime?: Date;
  readonly endTime?: Date;
  readonly totalSpent: number;
}

/**
 * User settings for the extension
 */
export interface ExtensionSettings {
  readonly autoFillEnabled: boolean;
  readonly defaultSupermarket: SupportedSupermarket;
  readonly showNotifications: boolean;
  readonly autoSelectBestPrice: boolean;
  readonly preferStoreBrands: boolean;
  readonly apiEndpoint: string;
  readonly theme: 'light' | 'dark' | 'system';
}

/**
 * Default extension settings
 */
export const DEFAULT_EXTENSION_SETTINGS: ExtensionSettings = {
  autoFillEnabled: false,
  defaultSupermarket: 'mercadona',
  showNotifications: true,
  autoSelectBestPrice: true,
  preferStoreBrands: false,
  apiEndpoint: 'http://localhost:3000/api',
  theme: 'system'
} as const;

/**
 * Message types for communication between popup, background, and content scripts
 */
export interface ExtensionMessage<T = unknown> {
  readonly type: ExtensionMessageType;
  readonly payload?: T;
  readonly tabId?: number;
}

export type ExtensionMessageType =
  | 'GET_GROCERY_LIST'
  | 'START_CART_FILL'
  | 'PAUSE_CART_FILL'
  | 'RESUME_CART_FILL'
  | 'CANCEL_CART_FILL'
  | 'GET_CART_STATUS'
  | 'ADD_ITEM_TO_CART'
  | 'SEARCH_PRODUCT'
  | 'GET_CURRENT_CART'
  | 'CLEAR_CART'
  | 'ITEM_STATUS_UPDATE'
  | 'SESSION_UPDATE'
  | 'GET_SETTINGS'
  | 'UPDATE_SETTINGS'
  | 'SYNC_GROCERY_LIST';

/**
 * Payload for starting cart fill
 */
export interface StartCartFillPayload {
  readonly groceryListId: string;
  readonly supermarket: SupportedSupermarket;
  readonly items: readonly GroceryItem[];
}

/**
 * Payload for adding a single item to cart
 */
export interface AddItemToCartPayload {
  readonly searchQuery: string;
  readonly quantity: number;
  readonly groceryItemId: string;
}

/**
 * Response from content script after adding item
 */
export interface AddItemResponse {
  readonly success: boolean;
  readonly productName?: string;
  readonly productPrice?: number;
  readonly errorMessage?: string;
}

/**
 * Search result from content script
 */
export interface ProductSearchResponse {
  readonly found: boolean;
  readonly products: readonly ScrapedProduct[];
}

/**
 * A product scraped from a supermarket website
 */
export interface ScrapedProduct {
  readonly id: string;
  readonly name: string;
  readonly price: number;
  readonly pricePerUnit?: string;
  readonly imageUrl?: string;
  readonly inStock: boolean;
  readonly isOffer: boolean;
  readonly originalPrice?: number;
}

/**
 * Supermarket-specific selectors for DOM manipulation
 */
export interface SupermarketSelectors {
  readonly searchInput: string;
  readonly searchButton: string;
  readonly productList: string;
  readonly productItem: string;
  readonly productName: string;
  readonly productPrice: string;
  readonly addToCartButton: string;
  readonly quantityInput?: string;
  readonly quantityIncrease?: string;
  readonly cartIcon: string;
  readonly cartTotal: string;
  readonly outOfStockIndicator?: string;
  readonly offerBadge?: string;
}

/**
 * API Response types
 */
export interface ApiResponse<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
}

export interface GroceryListResponse {
  readonly groceryList: GroceryList;
  readonly lastSynced: Date;
}

/**
 * Price comparison data
 */
export interface PriceComparison {
  readonly ingredientName: string;
  readonly supermarkets: readonly {
    readonly supermarket: SupportedSupermarket;
    readonly price: number;
    readonly productName: string;
    readonly inStock: boolean;
  }[];
  readonly bestDeal: SupportedSupermarket;
  readonly savings: number;
}
