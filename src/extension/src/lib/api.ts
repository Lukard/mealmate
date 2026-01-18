/**
 * Backend API Client
 * Handles communication with the meal automation backend
 */

import type { GroceryList, GroceryItem } from '@meal-automation/shared';
import type { ApiResponse, GroceryListResponse, PriceComparison, SupportedSupermarket } from '~/types';
import { settingsStorage } from './storage';

/**
 * API Client class
 */
class ApiClient {
  private baseUrl: string = 'http://localhost:3000/api';

  /**
   * Update the base URL from settings
   */
  async updateBaseUrl(): Promise<void> {
    const settings = await settingsStorage.get();
    this.baseUrl = settings.apiEndpoint;
  }

  /**
   * Make an authenticated request
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    await this.updateBaseUrl();

    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.message || `HTTP ${response.status}: ${response.statusText}`
        };
      }

      const data = await response.json();
      return {
        success: true,
        data
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }

  /**
   * GET request
   */
  private get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  /**
   * POST request
   */
  private post<T>(endpoint: string, body: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  /**
   * PUT request
   */
  private put<T>(endpoint: string, body: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  }

  /**
   * Grocery List Endpoints
   */

  /**
   * Get the current active grocery list
   */
  async getActiveGroceryList(): Promise<ApiResponse<GroceryListResponse>> {
    return this.get<GroceryListResponse>('/grocery-lists/active');
  }

  /**
   * Get a specific grocery list by ID
   */
  async getGroceryList(id: string): Promise<ApiResponse<GroceryList>> {
    return this.get<GroceryList>(`/grocery-lists/${id}`);
  }

  /**
   * Update grocery list item status (checked/unchecked)
   */
  async updateGroceryItemStatus(
    listId: string,
    itemId: string,
    checked: boolean
  ): Promise<ApiResponse<GroceryItem>> {
    return this.put<GroceryItem>(
      `/grocery-lists/${listId}/items/${itemId}`,
      { checked }
    );
  }

  /**
   * Product Search Endpoints
   */

  /**
   * Search products across supermarkets
   */
  async searchProducts(
    query: string,
    supermarket?: SupportedSupermarket
  ): Promise<ApiResponse<{
    products: unknown[];
    totalCount: number;
  }>> {
    const params = new URLSearchParams({ query });
    if (supermarket) {
      params.append('supermarket', supermarket);
    }
    return this.get(`/products/search?${params.toString()}`);
  }

  /**
   * Get price comparison for an ingredient
   */
  async getPriceComparison(
    ingredientName: string,
    supermarkets: readonly SupportedSupermarket[]
  ): Promise<ApiResponse<PriceComparison>> {
    return this.post<PriceComparison>('/products/compare', {
      ingredientName,
      supermarkets
    });
  }

  /**
   * Cart Automation Endpoints
   */

  /**
   * Log cart automation session start
   */
  async logSessionStart(
    groceryListId: string,
    supermarket: SupportedSupermarket
  ): Promise<ApiResponse<{ sessionId: string }>> {
    return this.post<{ sessionId: string }>('/automation/sessions', {
      groceryListId,
      supermarket,
      startTime: new Date().toISOString()
    });
  }

  /**
   * Log cart automation session completion
   */
  async logSessionComplete(
    sessionId: string,
    results: {
      totalItems: number;
      completedItems: number;
      failedItems: number;
      totalSpent: number;
    }
  ): Promise<ApiResponse<void>> {
    return this.put<void>(`/automation/sessions/${sessionId}/complete`, {
      ...results,
      endTime: new Date().toISOString()
    });
  }

  /**
   * Sync grocery list items that were added to cart
   */
  async syncCartAdditions(
    groceryListId: string,
    addedItems: readonly {
      itemId: string;
      productName: string;
      price: number;
      quantity: number;
    }[]
  ): Promise<ApiResponse<void>> {
    return this.post<void>(`/grocery-lists/${groceryListId}/sync-cart`, {
      addedItems,
      syncedAt: new Date().toISOString()
    });
  }

  /**
   * Health Check
   */
  async healthCheck(): Promise<ApiResponse<{ status: string; version: string }>> {
    return this.get<{ status: string; version: string }>('/health');
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export type for dependency injection in tests
export type { ApiClient };
