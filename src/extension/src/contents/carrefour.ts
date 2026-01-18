/**
 * Carrefour Content Script
 * Handles product search and cart operations on carrefour.es
 *
 * Note: This is a placeholder implementation. Carrefour support coming soon.
 */

import type PlasmoCSConfig from 'plasmo';
import type {
  AddItemToCartPayload,
  AddItemResponse,
  ProductSearchResponse,
  SupermarketSelectors
} from '~/types';

// Plasmo content script configuration
export const config: PlasmoCSConfig = {
  matches: ['https://www.carrefour.es/*'],
  run_at: 'document_end'
};

/**
 * DOM Selectors for Carrefour website
 * Note: These selectors need to be verified and updated
 */
const SELECTORS: SupermarketSelectors = {
  searchInput: 'input[data-test="search-input"], .search-input',
  searchButton: 'button[data-test="search-button"], .search-button',
  productList: '.product-list, .search-results',
  productItem: '.product-card',
  productName: '.product-card__title',
  productPrice: '.product-card__price',
  addToCartButton: '.product-card__add-btn',
  cartIcon: '.header-cart',
  cartTotal: '.cart-total'
};

/**
 * Placeholder: Search for a product on Carrefour
 */
async function searchProduct(query: string): Promise<ProductSearchResponse> {
  console.log('[Carrefour] Searching for:', query);
  console.log('[Carrefour] Support coming soon');

  return {
    found: false,
    products: []
  };
}

/**
 * Placeholder: Add item to cart
 */
async function handleAddItemToCart(
  payload: AddItemToCartPayload
): Promise<AddItemResponse> {
  console.log('[Carrefour] Add to cart requested:', payload);

  return {
    success: false,
    errorMessage: 'Carrefour support coming soon'
  };
}

/**
 * Listen for messages from background script
 */
chrome.runtime.onMessage.addListener(
  (
    message: { type: string; payload: unknown },
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void
  ) => {
    const { type, payload } = message;

    console.log('[Carrefour] Received message:', type);

    switch (type) {
      case 'ADD_ITEM_TO_CART':
        handleAddItemToCart(payload as AddItemToCartPayload)
          .then(sendResponse)
          .catch((error) => {
            sendResponse({
              success: false,
              errorMessage: error.message
            });
          });
        return true;

      case 'SEARCH_PRODUCT':
        searchProduct((payload as { query: string }).query)
          .then(sendResponse)
          .catch((error) => {
            sendResponse({
              found: false,
              products: [],
              error: error.message
            });
          });
        return true;

      default:
        console.log('[Carrefour] Unknown message type:', type);
        return false;
    }
  }
);

console.log('[Carrefour] Content script loaded (support coming soon)');
