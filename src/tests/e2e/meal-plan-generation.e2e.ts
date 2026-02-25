import { test, expect } from '@playwright/test';

const API_BASE = process.env.E2E_API_BASE || 'https://mealmate-ui.vercel.app';
const API_URL = `${API_BASE}/api/v1/ai/meal-plans/generate`;

const PROCESSED_KEYWORDS = [
  'empanado', 'empanada', 'empanadas', 'precocinado', 'precocinada',
  'preparado', 'preparada', 'ultracongelado', 'ultracongelada',
  'rebozado', 'rebozada', 'marinada', 'marinadas', 'marinado',
  'plato preparado', 'pizza congelada', 'croqueta', 'nugget',
  'nuggets', 'canelones', 'lasaña congelada',
];

const COOKING_VERBS = [
  'corta', 'pica', 'sofríe', 'saltea', 'hierve', 'cuece', 'hornea',
  'mezcla', 'bate', 'pela', 'trocea', 'asa', 'dora', 'rehoga',
  'cocina', 'añade', 'incorpora', 'sazona', 'aliña', 'fríe',
  'calienta el aceite', 'pon a hervir', 'precalienta',
];

function makeRequest(days: number, overrides: Record<string, unknown> = {}) {
  const start = new Date();
  const end = new Date(start);
  end.setDate(end.getDate() + days - 1);
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  return {
    startDate: fmt(start),
    endDate: fmt(end),
    preferences: { includeLunch: true, includeDinner: true, variety: 'high' },
    ...overrides,
  };
}

test.describe('Meal Plan Generation API', () => {
  test.describe.configure({ timeout: 120_000 });

  test('1. Basic: generates plan with entries', async ({ request }) => {
    const res = await request.post(API_URL, { data: makeRequest(1) });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.mealPlan.entries.length).toBeGreaterThan(0);
    // Each entry should have required fields
    for (const entry of json.data.mealPlan.entries) {
      expect(entry.recipeName).toBeTruthy();
      expect(entry.ingredients).toBeDefined();
      expect(entry.instructions).toBeDefined();
    }
  });

  test('2. Healthy: no processed products for balanced goal', async ({ request }) => {
    const res = await request.post(API_URL, {
      data: makeRequest(1, {
        health: { goals: ['balanced', 'whole-foods'], additionalNotes: 'Preferir ingredientes frescos' },
      }),
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);

    const entries = json.data.mealPlan.entries;
    for (const entry of entries) {
      const allText = [
        entry.recipeName,
        entry.description,
        ...(entry.ingredients || []),
      ].join(' ').toLowerCase();

      for (const kw of PROCESSED_KEYWORDS) {
        expect(allText, `Entry "${entry.recipeName}" contains processed keyword "${kw}"`).not.toContain(kw);
      }
    }
  });

  test('3. Fresh ingredients: uses raw/fresh ingredients', async ({ request }) => {
    const res = await request.post(API_URL, {
      data: makeRequest(1, {
        health: { goals: ['whole-foods'], additionalNotes: 'Solo ingredientes frescos' },
      }),
    });
    const json = await res.json();
    expect(json.success).toBe(true);

    const entries = json.data.mealPlan.entries;
    for (const entry of entries) {
      expect(entry.ingredients.length, `"${entry.recipeName}" should have ingredients`).toBeGreaterThan(1);
    }
  });

  test('4. Real recipes: instructions are real cooking steps', async ({ request }) => {
    const res = await request.post(API_URL, {
      data: makeRequest(1, {
        health: { goals: ['balanced'], additionalNotes: '' },
      }),
    });
    const json = await res.json();
    expect(json.success).toBe(true);

    for (const entry of json.data.mealPlan.entries) {
      expect(entry.instructions.length, `"${entry.recipeName}" should have multiple steps`).toBeGreaterThanOrEqual(2);
      
      const allInstructions = entry.instructions.join(' ').toLowerCase();
      const hasCookingVerb = COOKING_VERBS.some(v => allInstructions.includes(v));
      expect(hasCookingVerb, `"${entry.recipeName}" instructions should contain cooking verbs. Got: ${allInstructions.slice(0, 200)}`).toBe(true);
    }
  });

  test('5. Variety: 3-day plan has no repeated recipes', async ({ request }) => {
    const res = await request.post(API_URL, {
      data: makeRequest(3, {
        preferences: { includeLunch: true, includeDinner: true, variety: 'high' },
      }),
    });
    const json = await res.json();
    expect(json.success).toBe(true);

    const names = json.data.mealPlan.entries.map((e: { recipeName: string }) => e.recipeName.toLowerCase());
    const unique = new Set(names);
    expect(unique.size, `Expected ${names.length} unique recipes, got ${unique.size}. Recipes: ${names.join(', ')}`).toBe(names.length);
  });

  test('6. Budget: respects budget limit', async ({ request }) => {
    const budgetLimit = 50;
    const res = await request.post(API_URL, {
      data: makeRequest(1, {
        preferences: { includeLunch: true, includeDinner: true, budgetLimit },
      }),
    });
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.summary.estimatedCost).toBeLessThanOrEqual(budgetLimit * 1.2); // 20% tolerance
  });
});
