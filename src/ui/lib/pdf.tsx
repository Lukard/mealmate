'use client';

import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  pdf,
} from '@react-pdf/renderer';
import type { GroceryItem, GroceryList } from './store';

// Mapeo de categoría → emoji
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
  'Limpieza': '🧹',
  'Otros': '📦',
};

const getCategoryEmoji = (category: string): string => {
  return categoryEmojis[category] || '📦';
};

// Estilos del PDF
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },
  // Header
  header: {
    marginBottom: 25,
    borderBottomWidth: 2,
    borderBottomColor: '#22c55e',
    paddingBottom: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#22c55e',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 2,
  },
  headerStats: {
    alignItems: 'flex-end',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#22c55e',
  },
  statLabel: {
    fontSize: 10,
    color: '#6b7280',
  },
  // Category section
  categorySection: {
    marginBottom: 18,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginBottom: 8,
  },
  categoryEmoji: {
    fontSize: 14,
    marginRight: 8,
  },
  categoryTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#166534',
    flex: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  categorySubtotal: {
    fontSize: 11,
    color: '#166534',
    fontWeight: 'bold',
  },
  // Item row
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  checkbox: {
    width: 12,
    height: 12,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    borderRadius: 3,
    marginRight: 10,
  },
  itemName: {
    flex: 2,
    fontSize: 11,
    color: '#374151',
  },
  itemQuantity: {
    flex: 1,
    fontSize: 10,
    color: '#6b7280',
    textAlign: 'center',
  },
  itemPrice: {
    width: 60,
    fontSize: 11,
    color: '#374151',
    textAlign: 'right',
    fontWeight: 'bold',
  },
  // Footer
  footer: {
    marginTop: 25,
    paddingTop: 20,
    borderTopWidth: 2,
    borderTopColor: '#e5e7eb',
  },
  totalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#22c55e',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 15,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  footerText: {
    fontSize: 9,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 10,
  },
  // Summary row
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  summaryLabel: {
    fontSize: 10,
    color: '#6b7280',
  },
  summaryValue: {
    fontSize: 10,
    color: '#374151',
    fontWeight: 'bold',
  },
});

type CategoryGroup = {
  name: string;
  items: GroceryItem[];
  checked: number;
};

interface GroceryListPDFProps {
  groceryList: GroceryList;
  categorizedItems: CategoryGroup[];
}

// Componente del PDF
const GroceryListPDF = ({ groceryList, categorizedItems }: GroceryListPDFProps) => {
  const today = new Date();
  const formattedDate = today.toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Calcular subtotales por categoría
  const getCategorySubtotal = (items: GroceryItem[]): number => {
    return items.reduce((sum, item) => sum + item.estimatedPrice, 0);
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.title}>Lista de Compra - MealMate</Text>
              <Text style={styles.subtitle}>{formattedDate}</Text>
              <Text style={styles.subtitle}>
                {groceryList.items.length} productos en tu lista
              </Text>
            </View>
            <View style={styles.headerStats}>
              <Text style={styles.statValue}>
                {groceryList.totalEstimatedCost.toFixed(2)}€
              </Text>
              <Text style={styles.statLabel}>Coste estimado</Text>
            </View>
          </View>
        </View>

        {/* Categorías con items */}
        {categorizedItems.map((category) => {
          const subtotal = getCategorySubtotal(category.items);
          return (
            <View key={category.name} style={styles.categorySection} wrap={false}>
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryEmoji}>
                  {getCategoryEmoji(category.name)}
                </Text>
                <Text style={styles.categoryTitle}>{category.name}</Text>
                <Text style={styles.categorySubtotal}>
                  {subtotal.toFixed(2)}€
                </Text>
              </View>
              {category.items.map((item) => (
                <View key={item.id} style={styles.item}>
                  <View style={styles.checkbox} />
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemQuantity}>
                    {item.quantity} {item.unit}
                  </Text>
                  <Text style={styles.itemPrice}>
                    {item.estimatedPrice.toFixed(2)}€
                  </Text>
                </View>
              ))}
            </View>
          );
        })}

        {/* Footer con resumen */}
        <View style={styles.footer}>
          {/* Resumen */}
          <View style={{ marginBottom: 15 }}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total de productos:</Text>
              <Text style={styles.summaryValue}>{groceryList.items.length}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Categorías:</Text>
              <Text style={styles.summaryValue}>{categorizedItems.length}</Text>
            </View>
          </View>

          {/* Total destacado */}
          <View style={styles.totalSection}>
            <Text style={styles.totalLabel}>TOTAL ESTIMADO</Text>
            <Text style={styles.totalValue}>
              {groceryList.totalEstimatedCost.toFixed(2)}€
            </Text>
          </View>

          {/* Pie de página */}
          <Text style={styles.footerText}>
            Generado con MealMate • Los precios son estimaciones basadas en supermercados locales
          </Text>
        </View>
      </Page>
    </Document>
  );
};

/**
 * Genera y descarga el PDF de la lista de compra
 */
export async function generateGroceryListPDF(
  groceryList: GroceryList,
  categorizedItems: CategoryGroup[]
): Promise<void> {
  const blob = await pdf(
    <GroceryListPDF
      groceryList={groceryList}
      categorizedItems={categorizedItems}
    />
  ).toBlob();

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  
  // Nombre del archivo con fecha
  const today = new Date().toISOString().split('T')[0];
  link.download = `lista-compra-mealmate-${today}.pdf`;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Limpiar URL del blob
  URL.revokeObjectURL(url);
}

export { GroceryListPDF };
