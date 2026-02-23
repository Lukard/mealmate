/**
 * RAG Prompts - System and user prompt builders for meal plan generation
 * with real Mercadona products
 */

import { ProductMatch } from './product-embeddings';

// ============================================
// Product Context Builder
// ============================================

interface ProductForContext {
  name: string;
  price: number;
  category: string | null;
  brand?: string | null;
  size_format?: string | null;
}

/**
 * Build compact product context string grouped by category
 * Target: ~1K tokens
 */
export function buildProductContext(products: ProductForContext[]): string {
  // Group by category
  const byCategory = new Map<string, ProductForContext[]>();
  for (const p of products) {
    const cat = p.category || 'Otros';
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(p);
  }

  const lines: string[] = ['PRODUCTOS DISPONIBLES (Mercadona):'];
  for (const [cat, prods] of byCategory) {
    lines.push(`\n[${cat}]`);
    for (const p of prods) {
      const size = p.size_format ? ` (${p.size_format})` : '';
      lines.push(`- ${p.name}${size}: ${p.price.toFixed(2)}€`);
    }
  }
  return lines.join('\n');
}

// ============================================
// System Prompt
// ============================================

export const RAG_SYSTEM_PROMPT = `Eres un nutricionista y chef experto especializado en planificación de comidas para familias españolas.

REGLAS CRÍTICAS:
1. SOLO puedes usar los productos de la lista "PRODUCTOS DISPONIBLES" proporcionada
2. NO inventes productos ni marcas que no estén en la lista
3. Los ingredientes de cada receta DEBEN corresponder a productos reales de la lista
4. Incluye el nombre EXACTO del producto cuando lo uses como ingrediente
5. Genera recetas DIFERENTES cada día - NO repitas platos
6. Alterna entre carne, pescado, legumbres, huevos y verduras
7. Respeta el tiempo de preparación máximo
8. RESPETA los objetivos de salud del usuario

Para ingredientes básicos (sal, agua, especias comunes) puedes asumir que están disponibles.

Formato de respuesta (JSON estricto):
{
  "mealPlan": {
    "explanation": "Breve explicación del plan (2-3 frases)",
    "days": [
      {
        "date": "YYYY-MM-DD",
        "meals": {
          "breakfast": { 
            "name": "Nombre del plato",
            "prepTime": 15,
            "description": "Descripción breve",
            "ingredients": ["Producto exacto de la lista con cantidad"],
            "instructions": ["Paso 1", "Paso 2"]
          },
          "lunch": { ... },
          "dinner": { ... },
          "snack": { ... }
        }
      }
    ]
  }
}

SOLO incluye las comidas que el usuario solicite. Responde SOLO con JSON válido.`;

// ============================================
// User Prompt Builder
// ============================================

interface MealPlanParams {
  startDate: string;
  endDate: string;
  meals: string[];
  variety: string;
  maxPrepTime?: number;
  budgetLimit?: number;
  healthGoals: string[];
  healthNotes?: string;
  cuisineFocus?: string[];
}

export function buildUserPrompt(params: MealPlanParams, productContext: string): string {
  const parts: string[] = [];

  parts.push(productContext);
  parts.push('\n---\nSOLICITUD:');
  parts.push(`Período: ${params.startDate} a ${params.endDate}`);
  parts.push(`Comidas: ${params.meals.join(', ')}`);
  parts.push(`Variedad: ${params.variety}`);
  
  if (params.maxPrepTime) {
    parts.push(`Tiempo máximo de preparación: ${params.maxPrepTime} minutos`);
  }
  if (params.budgetLimit) {
    parts.push(`Presupuesto máximo: ${params.budgetLimit}€`);
  }
  if (params.healthGoals.length > 0) {
    parts.push(`Objetivos de salud: ${params.healthGoals.join(', ')}`);
  }
  if (params.healthNotes) {
    parts.push(`Notas adicionales: ${params.healthNotes}`);
  }
  if (params.cuisineFocus?.length) {
    parts.push(`Estilo de cocina: ${params.cuisineFocus.join(', ')}`);
  }

  parts.push('\nGenera el plan de comidas usando EXCLUSIVAMENTE los productos listados arriba.');
  return parts.join('\n');
}
