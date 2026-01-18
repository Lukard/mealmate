/**
 * DIA Content Script
 * Handles product search and cart operations on dia.es
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
  matches: ['https://www.dia.es/*', 'https://dia.es/*'],
  run_at: 'document_end'
};

/**
 * DOM Selectors for DIA website
 * Note: These selectors may need updates as DIA changes their website
 */
const SELECTORS: SupermarketSelectors = {
  searchInput: 'input[data-test="search-input"], input[name="q"], .search-input input',
  searchButton: 'button[data-test="search-button"], button[type="submit"].search-button',
  productList: '.product-list, .search-results, [data-test="product-list"]',
  productItem: '.product-card, .product-item, [data-test="product-card"]',
  productName: '.product-card__name, .product-name, [data-test="product-name"]',
  productPrice: '.product-card__price, .product-price, [data-test="product-price"]',
  addToCartButton: '.product-card__add-button, .add-to-cart, [data-test="add-to-cart"]',
  quantityInput: '.quantity-input input, [data-test="quantity-input"]',
  quantityIncrease: '.quantity-plus, [data-test="quantity-increase"]',
  cartIcon: '.cart-icon, [data-test="cart-icon"]',
  cartTotal: '.cart-total, [data-test="cart-total"]',
  outOfStockIndicator: '.out-of-stock, .product-unavailable',
  offerBadge: '.offer-badge, .discount-badge'
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
 * Search for a product on DIA
 */
async function searchProduct(query: string): Promise<ProductSearchResponse> {
  console.log('[DIA] Searching for:', query);

  try {
    // Find and fill the search input
    const searchInput = await waitForElement(SELECTORS.searchInput) as HTMLInputElement;
    if (!searchInput) {
      console.error('[DIA] Search input not found');
      return { found: false, products: [] };
    }

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
      // Try pressing Enter
      searchInput.dispatchEvent(new KeyboardEvent('keypress', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        bubbles: true
      }));
    }

    // Wait for results to load
    await delay(2000);
    await waitForElement(SELECTORS.productList);
    await delay(500);

    // Scrape products
    const products = scrapeProducts();
    console.log('[DIA] Found products:', products.length);

    return {
      found: products.length > 0,
      products
    };
  } catch (error) {
    console.error('[DIA] Search error:', error);
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

      const outOfStock = element.querySelector(SELECTORS.outOfStockIndicator ?? '') !== null;
      const hasOffer = element.querySelector(SELECTORS.offerBadge ?? '') !== null;

      const imageEl = element.querySelector('img');
      const imageUrl = imageEl?.src ?? imageEl?.getAttribute('data-src') ?? undefined;

      products.push({
        id: `dia_${index}_${Date.now()}`,
        name,
        price,
        imageUrl,
        inStock: !outOfStock,
        isOffer: hasOffer
      });
    } catch (error) {
      console.error('[DIA] Error scraping product:', error);
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

    // Check if out of stock
    const outOfStock = productElement.querySelector(SELECTORS.outOfStockIndicator ?? '');
    if (outOfStock) {
      return { success: false, error: 'Product out of stock' };
    }

    // Add to cart (click for each quantity)
    for (let i = 0; i < quantity; i++) {
      addButton.click();
      await delay(500);
    }

    console.log(`[DIA] Added ${quantity}x ${productName} to cart`);

    return {
      success: true,
      productName,
      productPrice
    };
  } catch (error) {
    console.error('[DIA] Error adding to cart:', error);
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

  return {
    total: parsePrice(totalText),
    itemCount: 0 // Would need specific selector for DIA
  };
}

/**
 * Add item to cart - main entry point
 */
async function handleAddItemToCart(
  payload: AddItemToCartPayload
): Promise<AddItemResponse> {
  const { searchQuery, quantity } = payload;

  // Search for the product
  const searchResult = await searchProduct(searchQuery);

  if (!searchResult.found || searchResult.products.length === 0) {
    return {
      success: false,
      errorMessage: `No products found for "${searchQuery}"`
    };
  }

  // Find the best matching product (first one for now)
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

    console.log('[DIA] Received message:', type);

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

      default:
        console.log('[DIA] Unknown message type:', type);
        return false;
    }
  }
);

console.log('[DIA] Content script loaded');
