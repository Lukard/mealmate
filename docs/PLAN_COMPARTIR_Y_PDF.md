# Plan de Implementación: Compartir Lista y Descargar PDF

## 📋 Resumen Ejecutivo

**Ubicación del código:** `/src/ui/app/grocery-list/page.tsx`
**Estado actual:** Los botones "Compartir lista" y "Descargar PDF" existen (líneas ~231-248) pero **no tienen handlers** - son botones estáticos sin funcionalidad.

---

## 🔍 Análisis del Código Actual

### Estructura de Datos (store.ts)

```typescript
// Cada item de la lista
interface GroceryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;      // Ej: "Frutas", "Lácteos", "Carnes"
  checked: boolean;
  estimatedPrice: number;
}

// Lista completa
interface GroceryList {
  id: string;
  mealPlanId: string;
  items: GroceryItem[];
  totalEstimatedCost: number;
}
```

### Variables ya calculadas en el componente

```typescript
// categorizedItems - items agrupados por categoría
const categorizedItems = useMemo(() => {
  // Retorna: { name: string, items: GroceryItem[], checked: number }[]
}, [groceryList]);

// progress - estadísticas de la lista
const progress = useMemo(() => {
  // Retorna: { checked: number, total: number, percentage: number }
}, [groceryList]);
```

### Botones actuales (sin funcionalidad)

```tsx
<Button fullWidth size="lg" variant="secondary">
  {/* Solo visual - SIN onClick */}
  Compartir lista
</Button>
<Button fullWidth size="lg">
  {/* Solo visual - SIN onClick */}
  Descargar PDF
</Button>
```

---

## 🚀 Feature 1: Compartir Lista

### Decisión de Diseño

**Recomendación:** Usar **Web Share API con fallback a clipboard**

| Opción | Pros | Contras |
|--------|------|---------|
| Web Share API | Nativo, permite WhatsApp/Email/etc | No soportado en desktop |
| Clipboard | Universal | Solo copia texto |
| **Ambos (fallback)** | ✅ Mejor UX en todos los dispositivos | Más código |

### Formato del Texto a Compartir

```
🛒 Lista de Compra - MealMate

📊 Resumen: 15/23 items | ~85.50 EUR

🥬 VERDURAS
☐ Tomates - 1 kg
☑ Cebollas - 500 g
☐ Lechuga - 2 unidades

🍎 FRUTAS  
☐ Manzanas - 6 unidades
...

💰 Coste estimado total: 85.50 EUR

Generado con MealMate
```

### UX: Feedback Visual

- **Toast notification** cuando se comparte/copia exitosamente
- Icono cambia brevemente a ✓
- Mensaje diferente según método usado:
  - "Lista compartida" (Web Share)
  - "Lista copiada al portapapeles" (Clipboard)

### Implementación

```typescript
// Nueva utilidad: /src/ui/lib/share.ts

export function formatGroceryListForShare(
  groceryList: GroceryList,
  categorizedItems: CategoryGroup[],
  progress: ProgressInfo
): string {
  let text = '🛒 Lista de Compra - MealMate\n\n';
  text += `📊 Resumen: ${progress.checked}/${progress.total} items | ~${groceryList.totalEstimatedCost.toFixed(2)} EUR\n\n`;

  const categoryEmojis: Record<string, string> = {
    'Frutas': '🍎',
    'Verduras': '🥬',
    'Carnes': '🥩',
    'Lácteos': '🧀',
    'Panadería': '🍞',
    // ... más categorías
  };

  categorizedItems.forEach(category => {
    const emoji = categoryEmojis[category.name] || '📦';
    text += `${emoji} ${category.name.toUpperCase()}\n`;
    category.items.forEach(item => {
      const checkbox = item.checked ? '☑' : '☐';
      text += `${checkbox} ${item.name} - ${item.quantity} ${item.unit}\n`;
    });
    text += '\n';
  });

  text += `💰 Coste estimado total: ${groceryList.totalEstimatedCost.toFixed(2)} EUR\n\n`;
  text += 'Generado con MealMate';

  return text;
}

export async function shareGroceryList(text: string): Promise<'shared' | 'copied' | 'error'> {
  // Intentar Web Share API primero
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Lista de Compra - MealMate',
        text: text,
      });
      return 'shared';
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Share failed:', err);
      }
    }
  }

  // Fallback: Copiar al clipboard
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch (err) {
    console.error('Clipboard failed:', err);
    return 'error';
  }
}
```

---

## 📄 Feature 2: Descargar PDF

### Decisión de Diseño

**Recomendación:** Generación **client-side con jsPDF**

| Opción | Pros | Contras |
|--------|------|---------|
| **jsPDF (client)** | ✅ Sin servidor, rápido, offline | Bundle size ~300KB |
| react-pdf | Más control visual | Más complejo |
| Server-side | Más potente | Requiere backend, latencia |

### Diseño del PDF (Versión Premium)

**Requisitos actualizados:**
- ✅ Perfectamente estructurado con jerarquía visual clara
- ✅ Iconos de categorías como imágenes SVG/PNG embebidas
- ✅ Header profesional con logo de MealMate
- ✅ Tipografía limpia y colores de marca
- ✅ Secciones bien delimitadas con líneas y espaciado

```
┌─────────────────────────────────────────────────────────────┐
│  ┌──────┐                                                   │
│  │ LOGO │   LISTA DE COMPRA                                │
│  │      │   Semana del 24 - 30 Feb 2025                    │
│  └──────┘   23 productos • ~85.50€ estimado                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🥬 VERDURAS Y HORTALIZAS                         12.50€   │
│  ─────────────────────────────────────────────────────────  │
│  │ [img] Tomates              1 kg              2.50€     │
│  │ [img] Cebollas             500 g             1.20€     │
│  │ [img] Lechuga romana       2 unidades        2.80€     │
│                                                             │
│  🍎 FRUTAS                                         8.00€   │
│  ─────────────────────────────────────────────────────────  │
│  │ [img] Manzanas             6 unidades        3.00€     │
│  │ [img] Plátanos             1 kg              1.50€     │
│                                                             │
│  🥩 CARNES Y PROTEÍNAS                            25.00€   │
│  ─────────────────────────────────────────────────────────  │
│  │ [img] Pechuga de pollo     500 g             6.50€     │
│  │ [img] Salmón fresco        400 g            12.00€     │
│                                                             │
│  ... más categorías ...                                     │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   RESUMEN                                                   │
│   ─────────────────────────────────────                     │
│   Total productos:     23                                   │
│   Coste estimado:      85.50€                              │
│                                                             │
│   💡 Tip: Los precios son estimaciones basadas en          │
│      supermercados locales                                  │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  MealMate • Tu asistente de planificación de comidas       │
│  mealmate-ui.vercel.app                                     │
└─────────────────────────────────────────────────────────────┘
```

### Assets necesarios para el PDF

| Asset | Formato | Uso |
|-------|---------|-----|
| Logo MealMate | PNG base64 | Header del PDF |
| Iconos categorías | SVG/PNG base64 | Junto a cada sección |
| Iconos productos (opcional) | PNG pequeños | Al lado de cada item |

**Opción simplificada (sin imágenes de productos):**
- Solo logo + iconos de categoría
- Menor tamaño de archivo
- Más rápido de generar

**Opción premium (con imágenes):**
- Usar una API de imágenes de alimentos (Unsplash, Spoonacular)
- Cache de imágenes en cliente
- PDF más visual pero más pesado (~2-5MB)

### Librería recomendada (actualizado)

**Opción elegida: `@react-pdf/renderer`** en lugar de jsPDF

| Criterio | jsPDF | @react-pdf/renderer |
|----------|-------|---------------------|
| Diseño | Imperativo (coordenadas) | Declarativo (JSX/CSS) |
| Imágenes | Manual base64 | Soporte nativo |
| Tablas | Requiere plugin | Flexbox nativo |
| Tipografía | Limitada | Fuentes custom fáciles |
| Complejidad | Media | Baja |
| Bundle | ~300KB | ~500KB |

**Ventaja clave:** Con react-pdf podemos usar JSX y estilos CSS-like para crear layouts perfectamente estructurados sin calcular coordenadas manualmente.

### Implementación

```typescript
// Nueva utilidad: /src/ui/lib/pdf.tsx

import { Document, Page, View, Text, Image, StyleSheet, pdf } from '@react-pdf/renderer';

// Estilos del PDF
const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Helvetica',
  },
  header: {
    flexDirection: 'row',
    marginBottom: 20,
    borderBottom: '1px solid #e5e7eb',
    paddingBottom: 15,
  },
  logo: {
    width: 50,
    height: 50,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#22c55e',
  },
  categorySection: {
    marginBottom: 15,
  },
  categoryHeader: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    padding: 8,
    borderRadius: 4,
  },
  categoryIcon: {
    width: 20,
    height: 20,
    marginRight: 8,
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  item: {
    flexDirection: 'row',
    padding: '6 10',
    borderBottom: '1px solid #f3f4f6',
  },
  itemName: {
    flex: 2,
    fontSize: 11,
  },
  itemQuantity: {
    flex: 1,
    fontSize: 11,
    color: '#6b7280',
  },
  itemPrice: {
    width: 50,
    fontSize: 11,
    textAlign: 'right',
  },
  footer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
  },
  total: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});

// Componente del PDF
const GroceryListPDF = ({ groceryList, categorizedItems, logo, categoryIcons }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Header con logo */}
      <View style={styles.header}>
        {logo && <Image src={logo} style={styles.logo} />}
        <View>
          <Text style={styles.title}>Lista de Compra</Text>
          <Text style={{ fontSize: 10, color: '#6b7280' }}>
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </Text>
          <Text style={{ fontSize: 10, color: '#6b7280' }}>
            {groceryList.items.length} productos • ~{groceryList.totalEstimatedCost.toFixed(2)}€
          </Text>
        </View>
      </View>

      {/* Categorías con items */}
      {categorizedItems.map((category) => (
        <View key={category.name} style={styles.categorySection}>
          <View style={styles.categoryHeader}>
            {categoryIcons[category.name] && (
              <Image src={categoryIcons[category.name]} style={styles.categoryIcon} />
            )}
            <Text style={styles.categoryTitle}>{category.name.toUpperCase()}</Text>
          </View>
          {category.items.map((item) => (
            <View key={item.id} style={styles.item}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemQuantity}>{item.quantity} {item.unit}</Text>
              <Text style={styles.itemPrice}>{item.estimatedPrice.toFixed(2)}€</Text>
            </View>
          ))}
        </View>
      ))}

      {/* Footer con total */}
      <View style={styles.footer}>
        <Text style={styles.total}>Total Estimado: {groceryList.totalEstimatedCost.toFixed(2)}€</Text>
      </View>
    </Page>
  </Document>
);

// Función para generar y descargar
export async function generateGroceryListPDF(groceryList, categorizedItems, assets) {
  const blob = await pdf(
    <GroceryListPDF 
      groceryList={groceryList}
      categorizedItems={categorizedItems}
      logo={assets?.logo}
      categoryIcons={assets?.categoryIcons || {}}
    />
  ).toBlob();
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `lista-compra-${new Date().toISOString().split('T')[0]}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
```

### Alternativa ligera con jsPDF (si se prefiere menor bundle)

```typescript
// /src/ui/lib/pdf.ts

import { jsPDF } from 'jspdf';

export function generateGroceryListPDF(
  groceryList: GroceryList,
  categorizedItems: CategoryGroup[]
): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Header
  doc.setFontSize(24);
  doc.setTextColor(34, 197, 94); // primary-600
  doc.text('🍽️ MealMate', 20, y);
  y += 10;

  doc.setFontSize(18);
  doc.setTextColor(0, 0, 0);
  doc.text('Lista de Compra', 20, y);
  y += 8;

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generado el ${new Date().toLocaleDateString('es-ES')}`, 20, y);
  y += 15;

  // Categorías
  categorizedItems.forEach(category => {
    // Check si necesitamos nueva página
    if (y > 270) {
      doc.addPage();
      y = 20;
    }

    // Título de categoría
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'bold');
    doc.text(category.name.toUpperCase(), 20, y);
    y += 8;

    // Items
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    
    category.items.forEach(item => {
      const checkbox = item.checked ? '☑' : '☐';
      const itemText = `${checkbox} ${item.name}`;
      const quantityText = `${item.quantity} ${item.unit}`;
      const priceText = `${item.estimatedPrice.toFixed(2)}€`;

      doc.text(itemText, 25, y);
      doc.text(quantityText, 100, y);
      doc.text(priceText, pageWidth - 35, y, { align: 'right' });
      y += 6;
    });

    y += 5;
  });

  // Footer con total
  y += 10;
  doc.setDrawColor(200, 200, 200);
  doc.line(20, y, pageWidth - 20, y);
  y += 10;

  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text(`Total Estimado: ${groceryList.totalEstimatedCost.toFixed(2)}€`, 20, y);
  y += 8;
  
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text(`${groceryList.items.length} items`, 20, y);

  // Guardar
  doc.save('lista-compra-mealmate.pdf');
}
```

---

## 📦 Dependencias Necesarias

```bash
# Opción recomendada (PDFs con JSX)
npm install @react-pdf/renderer

# Alternativa ligera
npm install jspdf
```

**Impacto en bundle:**
- `@react-pdf/renderer`: ~500KB (mejor para diseños complejos con imágenes)
- `jspdf`: ~300KB (más ligero pero diseño más manual)

> **Recomendación:** Usar `@react-pdf/renderer` para el PDF estructurado con imágenes

## 🖼️ Assets Necesarios

Para el PDF premium necesitamos preparar:

### 1. Logo de MealMate
- Formato: PNG con fondo transparente
- Tamaño: 200x200px (se escalará)
- Ubicación: `/public/images/logo.png`

### 2. Iconos de Categorías
Crear o descargar iconos para cada categoría:

| Categoría | Icono sugerido |
|-----------|----------------|
| Frutas | 🍎 manzana |
| Verduras | 🥬 lechuga |
| Carnes | 🥩 filete |
| Pescados | 🐟 pescado |
| Lácteos | 🧀 queso |
| Panadería | 🍞 pan |
| Bebidas | 🥤 vaso |
| Despensa | 🏪 estante |
| Congelados | ❄️ copo |
| Otros | 📦 caja |

**Opción 1:** Iconos PNG simples (32x32px) - `/public/icons/categories/`
**Opción 2:** Usar emojis como fallback (sin archivos adicionales)

### 3. Tipografía (opcional)
Para una tipografía más profesional:
```typescript
import { Font } from '@react-pdf/renderer';

Font.register({
  family: 'Inter',
  src: '/fonts/Inter-Regular.ttf',
});
```

---

## 📁 Archivos a Crear/Modificar

### Crear

| Archivo | Propósito |
|---------|-----------|
| `/src/ui/lib/share.ts` | Utilidades de compartir |
| `/src/ui/lib/pdf.ts` | Generación de PDF |
| `/src/ui/components/ui/Toast.tsx` | Componente de notificación |

### Modificar

| Archivo | Cambios |
|---------|---------|
| `/src/ui/app/grocery-list/page.tsx` | Añadir handlers onClick, estado de loading, toast |
| `/src/ui/components/ui/index.ts` | Exportar Toast |
| `package.json` | Añadir jspdf |

---

## 📊 Estimación de Complejidad

| Feature | Complejidad | Tiempo Estimado |
|---------|-------------|-----------------|
| Compartir Lista | ⭐⭐ Media | 2-3 horas |
| Descargar PDF | ⭐⭐⭐ Media-Alta | 3-4 horas |
| Toast Component | ⭐ Baja | 1 hora |
| **Total** | | **6-8 horas** |

---

## 📋 Orden de Implementación Recomendado

1. **Toast Component** (base para feedback)
   - Crear componente reutilizable
   - Exportar en ui/index.ts

2. **Compartir Lista**
   - Crear `/lib/share.ts`
   - Modificar grocery-list page
   - Probar en móvil y desktop

3. **Descargar PDF**
   - Instalar jspdf
   - Crear `/lib/pdf.ts`
   - Añadir handler en página
   - Refinar diseño del PDF

4. **Testing & Polish**
   - Probar en diferentes navegadores
   - Verificar accesibilidad
   - Ajustar estilos

---

## 🎯 Decisiones Pendientes

1. **¿Incluir meal plan en el PDF?**
   - Pro: Más útil para el usuario
   - Contra: PDF más largo, más complejidad
   - **Recomendación:** Fase 2 - Primero solo lista de compras

2. **¿Logo en el PDF?**
   - Requiere base64 del logo
   - **Recomendación:** Emoji 🍽️ por ahora, logo en fase 2

3. **¿Versión imprimible (CSS @media print)?**
   - Alternativa ligera sin jsPDF
   - **Recomendación:** Considerar como opción adicional

---

## 💡 Mejoras Futuras (Fase 2)

- [ ] Añadir meal plan al PDF
- [ ] Logo real de MealMate
- [ ] Opción de imprimir directamente
- [ ] Compartir como imagen (html2canvas)
- [ ] Integración con apps de notas (Keep, Notion)
- [ ] Código QR en PDF para abrir en app
