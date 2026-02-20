import type { GroceryItem, GroceryList } from './store';

export type CategoryGroup = {
  name: string;
  items: GroceryItem[];
  checked: number;
};

export type ProgressInfo = {
  checked: number;
  total: number;
  percentage: number;
};

const categoryEmojis: Record<string, string> = {
  'Frutas': '🍎',
  'Verduras': '🥬',
  'Carnes': '🥩',
  'Pescados': '🐟',
  'Lácteos': '🧀',
  'Panadería': '🍞',
  'Bebidas': '🥤',
  'Despensa': '🏪',
  'Congelados': '❄️',
  'Condimentos': '🧂',
  'Cereales': '🌾',
  'Legumbres': '🫘',
  'Huevos': '🥚',
  'Aceites': '🫒',
  'Snacks': '🍿',
  'Limpieza': '🧹',
  'Otros': '📦',
};

export function formatGroceryListForShare(
  groceryList: GroceryList,
  categorizedItems: CategoryGroup[],
  progress: ProgressInfo
): string {
  let text = '🛒 Lista de Compra - MealMate\n\n';
  text += `📊 Resumen: ${progress.checked}/${progress.total} items | ~${groceryList.totalEstimatedCost.toFixed(2)} EUR\n\n`;

  categorizedItems.forEach((category) => {
    const emoji = categoryEmojis[category.name] || '📦';
    text += `${emoji} ${category.name.toUpperCase()}\n`;
    category.items.forEach((item) => {
      const checkbox = item.checked ? '☑' : '☐';
      text += `${checkbox} ${item.name} - ${item.quantity} ${item.unit}\n`;
    });
    text += '\n';
  });

  text += `💰 Coste estimado total: ${groceryList.totalEstimatedCost.toFixed(2)} EUR\n\n`;
  text += 'Generado con MealMate 🍽️';

  return text;
}

export async function shareGroceryList(text: string): Promise<'shared' | 'copied' | 'error'> {
  // Try Web Share API first (mainly for mobile)
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: 'Lista de Compra - MealMate',
        text: text,
      });
      return 'shared';
    } catch (err) {
      // User cancelled the share - not an error
      if ((err as Error).name === 'AbortError') {
        return 'error';
      }
      console.error('Share failed:', err);
    }
  }

  // Fallback: Copy to clipboard
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return 'copied';
    } catch (err) {
      console.error('Clipboard failed:', err);
      return 'error';
    }
  }

  return 'error';
}
