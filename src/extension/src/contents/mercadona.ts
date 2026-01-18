/**
 * Mercadona Content Script
 * Handles product search and cart operations on tienda.mercadona.es
 */

import type PlasmoCSConfig from 'plasmo';
import type {
  AddItemToCartPayload,
  AddItemResponse,
  ScrapedProduct,
  ProductSearchResponse,
  SupermarketSelectors
} from '~/types';

// Plasmo content script configuration
export const config: PlasmoCSConfig = {
  matches: ['https://tienda.mercadona.es/*', 'https://www.mercadona.es/*'],
  run_at: 'document_end'
};

/**
 * DOM Selectors for Mercadona website
 * Note: These selectors may need updates as Mercadona changes their website
 */
const SELECTORS: SupermarketSelectors = {
  searchInput: 'input[data-test="search-bar-input"], input.search-input, #search-input',
  searchButton: 'button[data-test="search-bar-button"], .search-submit-button',
  productList: '.product-cell-list, .search-results-list, [data-test="product-list"]',
  productItem: '.product-cell, [data-test="product-cell"]',
  productName: '.product-cell__description-name, [data-test="product-name"]',
  productPrice: '.product-cell__price-amount, [data-test="product-price"]',
  addToCartButton: '.product-cell__add-button, [data-test="add-to-cart-button"]',
  quantityInput: '.counter-input, [data-test="quantity-input"]',
  quantityIncrease: '.counter-button--increment, [data-test="quantity-increase"]',
  cartIcon: '.cart-icon, [data-test="cart-icon"]',
  cartTotal: '.cart-total, [data-test="cart-total"]',
  outOfStockIndicator: '.product-cell--unavailable, .out-of-stock',
  offerBadge: '.product-cell__offer-badge, .discount-badge'
};

/**
 * Wait for an element to appear in the DOM
 */
function waitForElement(selector: string, timeout = 10000): Promise<Element | null> {
  return new Promise((resolve) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver((mutations, obs) => {
      const el = document.querySelector(selector);
      if (el) {
        obs.disconnect();
        resolve(el);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}

/**
 * Delay helper
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if user is logged in to Mercadona
 */
function isUserLoggedIn(): boolean {
  // Mercadona requires login for cart operations
  // Check for typical logged-in indicators
  const userMenu = document.querySelector('.user-menu, [data-test="user-menu"]');
  const loginButton = document.querySelector('.login-button, [data-test="login-button"]');

  return !!userMenu && !loginButton;
}

/**
 * Search for a product on Mercadona
 */
async function searchProduct(query: string): Promise<ProductSearchResponse> {
  console.log('[Mercadona] Searching for:', query);

  try {
    // Navigate to search URL directly (Mercadona uses URL-based search)
    const searchUrl = `https://tienda.mercadona.es/search?query=${encodeURIComponent(query)}`;

    // If we're not on a search page, navigate there
    if (!window.location.href.includes('/search')) {
      window.location.href = searchUrl;
      // The page will reload, results will be scraped on next load
      return { found: false, products: [] };
    }

    // Try using the search input if we're already on the site
    const searchInput = await waitForElement(SELECTORS.searchInput) as HTMLInputElement;

    if (searchInput) {
      // Clear and fill the search input
      searchInput.value = '';
      searchInput.focus();

      // Simulate typing
      for (const char of query) {
        searchInput.value += char;
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        await delay(50);
      }

      // Submit search
      const searchButton = document.querySelector(SELECTORS.searchButton) as HTMLButtonElement;
      if (searchButton) {
        searchButton.click();
      } else {
        searchInput.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          bubbles: true
        }));
      }
    }

    // Wait for results to load
    await delay(2500);
    await waitForElement(SELECTORS.productList);
    await delay(500);

    // Scrape products
    const products = scrapeProducts();
    console.log('[Mercadona] Found products:', products.length);

    return {
      found: products.length > 0,
      products
    };
  } catch (error) {
    console.error('[Mercadona] Search error:', error);
    return { found: false, products: [] };
  }
}

/**
 * Scrape product information from the current page
 */
function scrapeProducts(): readonly ScrapedProduct[] {
  const productElements = document.querySelectorAll(SELECTORS.productItem);
  const products: ScrapedProduct[] = [];

  productElements.forEach((element, index) => {
    try {
      const nameEl = element.querySelector(SELECTORS.productName);
      const priceEl = element.querySelector(SELECTORS.productPrice);

      if (!nameEl || !priceEl) return;

      const name = nameEl.textContent?.trim() ?? '';
      const priceText = priceEl.textContent?.trim() ?? '0';
      const price = parsePrice(priceText);

      // Mercadona-specific: check for unavailability
      const isUnavailable =
        element.classList.contains('product-cell--unavailable') ||
        element.querySelector(SELECTORS.outOfStockIndicator ?? '') !== null;

      const hasOffer =
        element.classList.contains('product-cell--offer') ||
        element.querySelector(SELECTORS.offerBadge ?? '') !== null;

      const imageEl = element.querySelector('img');
      const imageUrl = imageEl?.src ?? imageEl?.getAttribute('data-src') ?? undefined;

      // Get price per unit if available
      const pricePerUnitEl = element.querySelector('.product-cell__price-per-unit');
      const pricePerUnit = pricePerUnitEl?.textContent?.trim();

      products.push({
        id: `mercadona_${index}_${Date.now()}`,
        name,
        price,
        pricePerUnit,
        imageUrl,
        inStock: !isUnavailable,
        isOffer: hasOffer
      });
    } catch (error) {
      console.error('[Mercadona] Error scraping product:', error);
    }
  });

  return products;
}

/**
 * Parse price from text (e.g., "2,99 EUR" -> 2.99)
 */
function parsePrice(priceText: string): number {
  const cleanText = priceText
    .replace(/[^\d,.-]/g, '')
    .replace(',', '.');
  return parseFloat(cleanText) || 0;
}

/**
 * Add a product to cart
 */
async function addToCart(
  productIndex: number,
  quantity: number
): Promise<{ success: boolean; productName?: string; productPrice?: number; error?: string }> {
  try {
    // Check if user is logged in
    if (!isUserLoggedIn()) {
      return {
        success: false,
        error: 'Please log in to Mercadona to add items to cart'
      };
    }

    const productElements = document.querySelectorAll(SELECTORS.productItem);

    if (productIndex >= productElements.length) {
      return { success: false, error: 'Product not found' };
    }

    const productElement = productElements[productIndex];
    const nameEl = productElement.querySelector(SELECTORS.productName);
    const priceEl = productElement.querySelector(SELECTORS.productPrice);
    const addButton = productElement.querySelector(SELECTORS.addToCartButton) as HTMLButtonElement;

    if (!addButton) {
      return { success: false, error: 'Add to cart button not found' };
    }

    const productName = nameEl?.textContent?.trim() ?? 'Unknown';
    const productPrice = parsePrice(priceEl?.textContent ?? '0');

    // Check if unavailable
    const isUnavailable = productElement.classList.contains('product-cell--unavailable');
    if (isUnavailable) {
      return { success: false, error: 'Product out of stock' };
    }

    // Click add button first
    addButton.click();
    await delay(500);

    // Handle quantity (Mercadona uses a counter after adding)
    if (quantity > 1) {
      const increaseButton = productElement.querySelector(SELECTORS.quantityIncrease) as HTMLButtonElement;

      if (increaseButton) {
        for (let i = 1; i < quantity; i++) {
          increaseButton.click();
          await delay(300);
        }
      }
    }

    console.log(`[Mercadona] Added ${quantity}x ${productName} to cart`);

    return {
      success: true,
      productName,
      productPrice
    };
  } catch (error) {
    console.error('[Mercadona] Error adding to cart:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get current cart contents
 */
async function getCurrentCart(): Promise<{
  total: number;
  itemCount: number;
}> {
  const cartTotal = document.querySelector(SELECTORS.cartTotal);
  const totalText = cartTotal?.textContent ?? '0';

  // Try to get item count from cart icon badge
  const cartBadge = document.querySelector('.cart-icon__badge, [data-test="cart-badge"]');
  const itemCountText = cartBadge?.textContent ?? '0';

  return {
    total: parsePrice(totalText),
    itemCount: parseInt(itemCountText, 10) || 0
  };
}

/**
 * Clear the current cart
 */
async function clearCart(): Promise<{ success: boolean; error?: string }> {
  try {
    // This would require navigating to cart and removing items
    // Simplified for now
    console.log('[Mercadona] Clear cart requested');
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Add item to cart - main entry point
 */
async function handleAddItemToCart(
  payload: AddItemToCartPayload
): Promise<AddItemResponse> {
  const { searchQuery, quantity } = payload;

  // Check login status first
  if (!isUserLoggedIn()) {
    return {
      success: false,
      errorMessage: 'Please log in to Mercadona first'
    };
  }

  // Search for the product
  const searchResult = await searchProduct(searchQuery);

  if (!searchResult.found || searchResult.products.length === 0) {
    return {
      success: false,
      errorMessage: `No products found for "${searchQuery}"`
    };
  }

  // Find the best matching product (first one that's in stock)
  const bestMatch = searchResult.products.find((p) => p.inStock) ?? searchResult.products[0];
  const productIndex = searchResult.products.indexOf(bestMatch);

  if (!bestMatch.inStock) {
    return {
      success: false,
      errorMessage: `"${bestMatch.name}" is out of stock`
    };
  }

  // Add to cart
  const result = await addToCart(productIndex, quantity);

  return {
    success: result.success,
    productName: result.productName,
    productPrice: result.productPrice,
    errorMessage: result.error
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

    console.log('[Mercadona] Received message:', type);

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
        return true; // Async response

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

      case 'GET_CURRENT_CART':
        getCurrentCart()
          .then(sendResponse)
          .catch((error) => {
            sendResponse({
              total: 0,
              itemCount: 0,
              error: error.message
            });
          });
        return true;

      case 'CLEAR_CART':
        clearCart()
          .then(sendResponse)
          .catch((error) => {
            sendResponse({
              success: false,
              error: error.message
            });
          });
        return true;

      default:
        console.log('[Mercadona] Unknown message type:', type);
        return false;
    }
  }
);

console.log('[Mercadona] Content script loaded');
