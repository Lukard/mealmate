'use client';

import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  pdf,
} from '@react-pdf/renderer';
import type { GroceryItem, GroceryList, WeeklyMealPlan, MealItem, DayPlan } from './store';

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

// ============================================
// MEAL PLAN PDF
// ============================================

// Mapeo de día en inglés → español
const dayNames: Record<string, string> = {
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miércoles',
  thursday: 'Jueves',
  friday: 'Viernes',
  saturday: 'Sábado',
  sunday: 'Domingo',
};

// Mapeo de tipo de comida → español + emoji
const mealTypeNames: Record<string, { name: string; emoji: string }> = {
  breakfast: { name: 'Desayuno', emoji: '🌅' },
  lunch: { name: 'Almuerzo', emoji: '☀️' },
  dinner: { name: 'Cena', emoji: '🌙' },
  snack: { name: 'Merienda', emoji: '🍎' },
};

// Estilos para el Meal Plan PDF
const mealPlanStyles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#22c55e',
    paddingBottom: 15,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#22c55e',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: '#6b7280',
  },
  costBadge: {
    backgroundColor: '#22c55e',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  costText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  costLabel: {
    fontSize: 8,
    color: '#ffffff',
    opacity: 0.9,
  },
  // Day section
  daySection: {
    marginBottom: 12,
  },
  dayHeader: {
    backgroundColor: '#f0fdf4',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
    marginBottom: 6,
  },
  dayTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#166534',
    textTransform: 'uppercase',
  },
  mealsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  mealCard: {
    width: '48%',
    backgroundColor: '#fafafa',
    borderRadius: 4,
    padding: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#22c55e',
  },
  mealTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  mealEmoji: {
    fontSize: 10,
    marginRight: 4,
  },
  mealType: {
    fontSize: 8,
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  mealName: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 2,
  },
  mealDetails: {
    flexDirection: 'row',
    gap: 8,
  },
  mealDetail: {
    fontSize: 7,
    color: '#9ca3af',
  },
  emptyMeal: {
    fontSize: 9,
    color: '#d1d5db',
    fontStyle: 'italic',
  },
  // Footer
  footer: {
    marginTop: 'auto',
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  footerText: {
    fontSize: 8,
    color: '#9ca3af',
    textAlign: 'center',
  },
});

interface MealPlanPDFProps {
  mealPlan: WeeklyMealPlan;
}

const MealPlanPDF = ({ mealPlan }: MealPlanPDFProps) => {
  const weekStart = new Date(mealPlan.weekStartDate);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const formatDate = (date: Date) => date.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
  });

  const dateRange = `${formatDate(weekStart)} - ${formatDate(weekEnd)}, ${weekStart.getFullYear()}`;

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
  const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

  // Contar comidas totales
  let totalMeals = 0;
  days.forEach(day => {
    const dayPlan = mealPlan.days[day];
    mealTypes.forEach(type => {
      if (dayPlan[type]) totalMeals++;
    });
  });

  return (
    <Document>
      <Page size="A4" style={mealPlanStyles.page}>
        {/* Header */}
        <View style={mealPlanStyles.header}>
          <View style={mealPlanStyles.headerContent}>
            <View>
              <Text style={mealPlanStyles.title}>Plan de Comidas - MealMate</Text>
              <Text style={mealPlanStyles.subtitle}>{dateRange}</Text>
              <Text style={mealPlanStyles.subtitle}>{totalMeals} comidas planificadas</Text>
            </View>
            <View style={mealPlanStyles.costBadge}>
              <Text style={mealPlanStyles.costText}>{mealPlan.estimatedCost.toFixed(2)}€</Text>
              <Text style={mealPlanStyles.costLabel}>Coste estimado</Text>
            </View>
          </View>
        </View>

        {/* Days */}
        {days.map((day) => {
          const dayPlan = mealPlan.days[day];
          const meals = mealTypes.filter(type => dayPlan[type]);
          
          if (meals.length === 0) return null;

          return (
            <View key={day} style={mealPlanStyles.daySection} wrap={false}>
              <View style={mealPlanStyles.dayHeader}>
                <Text style={mealPlanStyles.dayTitle}>{dayNames[day]}</Text>
              </View>
              <View style={mealPlanStyles.mealsContainer}>
                {mealTypes.map((mealType) => {
                  const meal = dayPlan[mealType];
                  if (!meal) return null;

                  return (
                    <View key={mealType} style={mealPlanStyles.mealCard}>
                      <View style={mealPlanStyles.mealTypeRow}>
                        <Text style={mealPlanStyles.mealEmoji}>
                          {mealTypeNames[mealType].emoji}
                        </Text>
                        <Text style={mealPlanStyles.mealType}>
                          {mealTypeNames[mealType].name}
                        </Text>
                      </View>
                      <Text style={mealPlanStyles.mealName}>{meal.name}</Text>
                      <View style={mealPlanStyles.mealDetails}>
                        <Text style={mealPlanStyles.mealDetail}>
                          ⏱️ {meal.prepTimeMinutes} min
                        </Text>
                        <Text style={mealPlanStyles.mealDetail}>
                          👥 {meal.servings} pers.
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}

        {/* Footer */}
        <View style={mealPlanStyles.footer}>
          <Text style={mealPlanStyles.footerText}>
            Generado con MealMate • Tu asistente de planificación de comidas
          </Text>
        </View>
      </Page>
    </Document>
  );
};

/**
 * Genera y descarga el PDF del plan de comidas
 */
export async function generateMealPlanPDF(mealPlan: WeeklyMealPlan): Promise<void> {
  const blob = await pdf(<MealPlanPDF mealPlan={mealPlan} />).toBlob();

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  
  // Nombre del archivo con fecha de inicio de semana
  const weekStart = new Date(mealPlan.weekStartDate).toISOString().split('T')[0];
  link.download = `plan-comidas-mealmate-${weekStart}.pdf`;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

export { MealPlanPDF };
