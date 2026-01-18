/**
 * GroceryList Component
 * Displays the grocery list items with sync functionality
 */

import { useState } from 'react';
import type { GroceryList, GroceryItem } from '@meal-automation/shared';

interface GroceryListViewProps {
  groceryList: GroceryList | null;
  onSync: () => Promise<void>;
  isSyncing: boolean;
}

export function GroceryListView({
  groceryList,
  onSync,
  isSyncing
}: GroceryListViewProps) {
  const [checkedItems, setCheckedItems] = useState<Set<string>>(
    new Set(groceryList?.items.filter((item) => item.checked).map((item) => item.id) ?? [])
  );

  /**
   * Toggle item checked state locally
   * Note: This could be synced to backend in a full implementation
   */
  const handleToggleItem = (itemId: string) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  /**
   * Format price for display
   */
  const formatPrice = (cents: number): string => {
    return (cents / 100).toFixed(2) + ' EUR';
  };

  /**
   * Group items by category
   */
  const groupedItems = groceryList?.items.reduce(
    (acc, item) => {
      const category = item.category;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(item);
      return acc;
    },
    {} as Record<string, GroceryItem[]>
  );

  if (!groceryList) {
    return (
      <div className="empty-list">
        <p>No grocery list found</p>
        <button className="secondary-btn" onClick={onSync} disabled={isSyncing}>
          {isSyncing ? 'Syncing...' : 'Sync from App'}
        </button>
      </div>
    );
  }

  if (groceryList.items.length === 0) {
    return (
      <div className="empty-list">
        <p>Your grocery list is empty</p>
        <button className="secondary-btn" onClick={onSync} disabled={isSyncing}>
          {isSyncing ? 'Syncing...' : 'Sync from App'}
        </button>
      </div>
    );
  }

  return (
    <div className="grocery-list">
      {/* Header with sync button */}
      <div className="grocery-list-header">
        <h3>Grocery List ({groceryList.totalItems} items)</h3>
        <button className="secondary-btn sync-btn" onClick={onSync} disabled={isSyncing}>
          {isSyncing ? 'Syncing...' : 'Sync'}
        </button>
      </div>

      {/* Total estimate */}
      <div className="list-summary">
        <span>Estimated: {formatPrice(groceryList.totalEstimatedCostCents)}</span>
      </div>

      {/* Items grouped by category */}
      {groupedItems && Object.entries(groupedItems).map(([category, items]) => (
        <div key={category} className="category-section">
          <h4 className="category-title">{formatCategoryName(category)}</h4>
          <ul className="grocery-items">
            {items.map((item) => {
              const isChecked = checkedItems.has(item.id);
              return (
                <li
                  key={item.id}
                  className={`grocery-item ${isChecked ? 'checked' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggleItem(item.id)}
                    aria-label={`Mark ${item.ingredientName} as checked`}
                  />
                  <div className="item-details">
                    <span className="item-name">{item.ingredientName}</span>
                    <span className="item-quantity">
                      {item.totalQuantity} {item.unit}
                    </span>
                  </div>
                  {item.selectedMatch && (
                    <span className="item-price">
                      {formatPrice(item.selectedMatch.totalCostCents)}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/**
 * Format category name for display
 */
function formatCategoryName(category: string): string {
  const categoryNames: Record<string, string> = {
    produce: 'Produce',
    dairy: 'Dairy',
    meat: 'Meat & Poultry',
    seafood: 'Seafood',
    bakery: 'Bakery',
    frozen: 'Frozen',
    canned: 'Canned Goods',
    dry_goods: 'Dry Goods',
    condiments: 'Condiments',
    spices: 'Spices & Seasonings',
    beverages: 'Beverages',
    other: 'Other'
  };

  return categoryNames[category] ?? category;
}
