/**
 * Spanish Ingredients Utility
 * Translation maps and utilities for English-to-Spanish ingredient matching
 */

/**
 * Comprehensive ingredient translation map
 * Maps English ingredient names to Spanish equivalents and synonyms
 */
export const INGREDIENT_MAP: Record<string, readonly string[]> = {
  // Proteins - Meat
  'chicken': ['pollo', 'pechuga de pollo', 'muslo de pollo', 'pollo entero'],
  'chicken breast': ['pechuga de pollo', 'pechuga pollo', 'filete de pollo'],
  'chicken thigh': ['muslo de pollo', 'contramuslo de pollo', 'muslo pollo'],
  'chicken wings': ['alitas de pollo', 'alas de pollo'],
  'ground chicken': ['pollo picado', 'carne picada de pollo'],
  'beef': ['ternera', 'carne de ternera', 'carne de res', 'vacuno'],
  'ground beef': ['carne picada', 'carne molida', 'ternera picada', 'picada de ternera'],
  'steak': ['filete', 'bistec', 'entrecot', 'solomillo', 'filete de ternera'],
  'pork': ['cerdo', 'carne de cerdo'],
  'pork chop': ['chuleta de cerdo', 'chuleta cerdo', 'costilla de cerdo'],
  'bacon': ['bacon', 'beicon', 'panceta', 'tocino'],
  'ham': ['jamon', 'jamon cocido', 'jamon york', 'jamon serrano'],
  'sausage': ['salchicha', 'chorizo', 'longaniza', 'butifarra'],
  'chorizo': ['chorizo', 'chorizo iberico', 'chorizo casero'],
  'lamb': ['cordero', 'carne de cordero'],
  'turkey': ['pavo', 'carne de pavo', 'pechuga de pavo'],
  'duck': ['pato', 'carne de pato'],
  'rabbit': ['conejo', 'carne de conejo'],

  // Proteins - Seafood
  'fish': ['pescado', 'pescado fresco'],
  'salmon': ['salmon', 'filete de salmon', 'salmon fresco'],
  'tuna': ['atun', 'atun fresco', 'bonito'],
  'cod': ['bacalao', 'bacalao fresco', 'bacalao desalado'],
  'hake': ['merluza', 'filete de merluza'],
  'sea bass': ['lubina', 'robalo'],
  'sea bream': ['dorada', 'besugo'],
  'trout': ['trucha', 'trucha fresca'],
  'sardines': ['sardinas', 'sardina'],
  'anchovies': ['anchoas', 'boquerones'],
  'shrimp': ['gambas', 'langostinos', 'camarones', 'gambas peladas'],
  'prawns': ['langostinos', 'gambas grandes'],
  'squid': ['calamares', 'calamar', 'chipirones'],
  'octopus': ['pulpo', 'pulpo cocido'],
  'mussels': ['mejillones', 'mejillon'],
  'clams': ['almejas', 'almeja'],
  'crab': ['cangrejo', 'carne de cangrejo'],
  'lobster': ['langosta', 'bogavante'],

  // Dairy
  'milk': ['leche', 'leche entera', 'leche semidesnatada', 'leche desnatada'],
  'whole milk': ['leche entera'],
  'skim milk': ['leche desnatada', 'leche descremada'],
  'cream': ['nata', 'nata liquida', 'nata para cocinar', 'crema de leche'],
  'heavy cream': ['nata para montar', 'nata espesa'],
  'sour cream': ['nata agria', 'crema agria'],
  'butter': ['mantequilla', 'manteca'],
  'cheese': ['queso', 'queso rallado'],
  'cheddar': ['queso cheddar', 'cheddar'],
  'mozzarella': ['mozzarella', 'queso mozzarella'],
  'parmesan': ['parmesano', 'queso parmesano', 'parmigiano'],
  'goat cheese': ['queso de cabra', 'queso cabra'],
  'cream cheese': ['queso crema', 'queso philadelphia', 'queso de untar'],
  'feta': ['queso feta', 'feta'],
  'manchego': ['queso manchego', 'manchego'],
  'yogurt': ['yogur', 'yogurt'],
  'greek yogurt': ['yogur griego', 'yogur natural'],
  'eggs': ['huevos', 'huevo'],
  'egg': ['huevo', 'huevos'],

  // Vegetables
  'tomato': ['tomate', 'tomates', 'tomate natural'],
  'tomatoes': ['tomates', 'tomate'],
  'cherry tomatoes': ['tomates cherry', 'tomatitos'],
  'tomato sauce': ['tomate frito', 'salsa de tomate', 'tomate triturado'],
  'canned tomatoes': ['tomate triturado', 'tomate pelado', 'tomate en conserva'],
  'onion': ['cebolla', 'cebolla blanca', 'cebolla amarilla'],
  'red onion': ['cebolla roja', 'cebolla morada'],
  'spring onion': ['cebolleta', 'cebollino', 'cebolla tierna'],
  'garlic': ['ajo', 'ajos', 'dientes de ajo'],
  'potato': ['patata', 'patatas', 'papa'],
  'potatoes': ['patatas', 'patata', 'papas'],
  'sweet potato': ['boniato', 'batata', 'patata dulce'],
  'carrot': ['zanahoria', 'zanahorias'],
  'carrots': ['zanahorias', 'zanahoria'],
  'celery': ['apio', 'tallo de apio'],
  'bell pepper': ['pimiento', 'pimientos', 'pimiento morron'],
  'red pepper': ['pimiento rojo', 'pimiento morron rojo'],
  'green pepper': ['pimiento verde'],
  'yellow pepper': ['pimiento amarillo'],
  'chili pepper': ['guindilla', 'chile', 'pimiento picante', 'aji'],
  'jalapeno': ['jalapeno', 'chile jalapeno'],
  'lettuce': ['lechuga', 'lechuga romana', 'lechuga iceberg'],
  'spinach': ['espinacas', 'espinaca'],
  'kale': ['col rizada', 'kale', 'berza'],
  'arugula': ['rucula', 'rucola'],
  'cabbage': ['col', 'repollo'],
  'red cabbage': ['lombarda', 'col lombarda', 'col morada'],
  'broccoli': ['brocoli', 'brecol'],
  'cauliflower': ['coliflor'],
  'zucchini': ['calabacin', 'calabaza italiana'],
  'eggplant': ['berenjena', 'berenjenas'],
  'cucumber': ['pepino', 'pepinos'],
  'mushrooms': ['champinones', 'setas', 'champiñones'],
  'mushroom': ['champinon', 'seta'],
  'asparagus': ['esparragos', 'esparrago'],
  'green beans': ['judias verdes', 'habichuelas', 'ejotes'],
  'peas': ['guisantes', 'arvejas', 'chicharos'],
  'corn': ['maiz', 'maiz dulce', 'elote'],
  'artichoke': ['alcachofa', 'alcachofas'],
  'leek': ['puerro', 'puerros'],
  'beet': ['remolacha', 'betabel'],
  'radish': ['rabano', 'rabanitos'],
  'turnip': ['nabo', 'nabos'],
  'squash': ['calabaza', 'calabacin'],
  'pumpkin': ['calabaza', 'calabaza naranja'],
  'avocado': ['aguacate', 'palta'],

  // Fruits
  'apple': ['manzana', 'manzanas'],
  'orange': ['naranja', 'naranjas'],
  'lemon': ['limon', 'limones'],
  'lime': ['lima', 'limon verde'],
  'banana': ['platano', 'banana', 'platanos'],
  'strawberry': ['fresa', 'fresas', 'frutillas'],
  'strawberries': ['fresas', 'fresa'],
  'blueberries': ['arandanos', 'arandano azul'],
  'raspberries': ['frambuesas', 'frambuesa'],
  'grapes': ['uvas', 'uva'],
  'watermelon': ['sandia'],
  'melon': ['melon', 'melon cantalupo'],
  'pineapple': ['pina', 'anana'],
  'mango': ['mango', 'mangos'],
  'peach': ['melocoton', 'durazno'],
  'pear': ['pera', 'peras'],
  'plum': ['ciruela', 'ciruelas'],
  'cherry': ['cereza', 'cerezas'],
  'apricot': ['albaricoque', 'damasco'],
  'kiwi': ['kiwi', 'kiwis'],
  'pomegranate': ['granada'],
  'fig': ['higo', 'higos'],
  'dates': ['datiles', 'datil'],
  'raisins': ['pasas', 'uvas pasas'],

  // Grains and Carbs
  'rice': ['arroz', 'arroz blanco', 'arroz largo'],
  'white rice': ['arroz blanco', 'arroz largo'],
  'brown rice': ['arroz integral'],
  'pasta': ['pasta', 'pasta italiana'],
  'spaghetti': ['espaguetis', 'spaghetti', 'espagueti'],
  'penne': ['penne', 'macarrones', 'plumas'],
  'macaroni': ['macarrones', 'macaroni'],
  'noodles': ['fideos', 'tallarines'],
  'bread': ['pan', 'pan de molde', 'pan blanco'],
  'white bread': ['pan blanco', 'pan de molde'],
  'whole wheat bread': ['pan integral', 'pan de trigo integral'],
  'baguette': ['baguette', 'barra de pan'],
  'tortilla': ['tortilla', 'tortilla de trigo', 'tortilla mexicana'],
  'flour': ['harina', 'harina de trigo'],
  'all-purpose flour': ['harina de trigo', 'harina comun'],
  'whole wheat flour': ['harina integral', 'harina de trigo integral'],
  'cornmeal': ['harina de maiz', 'polenta'],
  'oats': ['avena', 'copos de avena'],
  'quinoa': ['quinoa', 'quinua'],
  'couscous': ['cuscus', 'cous cous'],
  'bulgur': ['bulgur', 'trigo bulgur'],

  // Legumes
  'beans': ['judias', 'alubias', 'frijoles', 'habichuelas'],
  'black beans': ['judias negras', 'frijoles negros', 'alubias negras'],
  'kidney beans': ['judias rojas', 'alubias rojas', 'frijoles rojos'],
  'white beans': ['judias blancas', 'alubias blancas', 'fabes'],
  'chickpeas': ['garbanzos', 'garbanzo'],
  'lentils': ['lentejas', 'lenteja'],
  'pinto beans': ['judias pintas', 'frijoles pintos'],

  // Oils and Fats
  'olive oil': ['aceite de oliva', 'aceite oliva virgen', 'aove', 'aceite de oliva virgen extra'],
  'extra virgin olive oil': ['aceite de oliva virgen extra', 'aove'],
  'vegetable oil': ['aceite vegetal', 'aceite de girasol'],
  'sunflower oil': ['aceite de girasol'],
  'coconut oil': ['aceite de coco'],

  // Condiments and Sauces
  'salt': ['sal', 'sal fina', 'sal marina'],
  'pepper': ['pimienta', 'pimienta negra', 'pimienta molida'],
  'black pepper': ['pimienta negra', 'pimienta'],
  'sugar': ['azucar', 'azucar blanco'],
  'brown sugar': ['azucar moreno', 'azucar integral'],
  'honey': ['miel', 'miel de abeja'],
  'vinegar': ['vinagre', 'vinagre de vino'],
  'balsamic vinegar': ['vinagre balsamico', 'aceto balsamico'],
  'apple cider vinegar': ['vinagre de manzana', 'vinagre de sidra'],
  'soy sauce': ['salsa de soja', 'soja', 'salsa soja'],
  'mustard': ['mostaza'],
  'ketchup': ['ketchup', 'salsa de tomate', 'catsup'],
  'mayonnaise': ['mayonesa', 'mahonesa'],
  'hot sauce': ['salsa picante', 'tabasco', 'salsa hot'],
  'worcestershire sauce': ['salsa worcestershire', 'salsa inglesa', 'salsa perrins'],
  'fish sauce': ['salsa de pescado', 'nuoc mam'],
  'tomato paste': ['concentrado de tomate', 'tomate concentrado', 'pasta de tomate'],
  'pesto': ['pesto', 'salsa pesto'],

  // Herbs and Spices
  'oregano': ['oregano'],
  'basil': ['albahaca', 'albahaca fresca'],
  'parsley': ['perejil', 'perejil fresco'],
  'cilantro': ['cilantro', 'coriandro', 'culantro'],
  'coriander': ['cilantro', 'coriandro', 'semillas de cilantro'],
  'thyme': ['tomillo'],
  'rosemary': ['romero'],
  'bay leaves': ['laurel', 'hojas de laurel'],
  'bay leaf': ['laurel', 'hoja de laurel'],
  'mint': ['menta', 'hierbabuena'],
  'dill': ['eneldo'],
  'sage': ['salvia'],
  'chives': ['cebollino', 'ciboulette'],
  'tarragon': ['estragon'],
  'cumin': ['comino', 'comino molido'],
  'paprika': ['pimenton', 'paprika', 'pimenton dulce'],
  'smoked paprika': ['pimenton ahumado', 'pimenton de la vera'],
  'cayenne': ['cayena', 'pimienta de cayena'],
  'chili powder': ['chile en polvo', 'guindilla molida'],
  'curry powder': ['curry', 'curry en polvo'],
  'turmeric': ['curcuma'],
  'ginger': ['jengibre', 'jengibre fresco', 'jengibre molido'],
  'cinnamon': ['canela', 'canela molida', 'canela en rama'],
  'nutmeg': ['nuez moscada'],
  'cloves': ['clavo', 'clavos de olor'],
  'cardamom': ['cardamomo'],
  'saffron': ['azafran'],
  'vanilla': ['vainilla', 'esencia de vainilla', 'extracto de vainilla'],

  // Nuts and Seeds
  'almonds': ['almendras', 'almendra'],
  'walnuts': ['nueces', 'nuez'],
  'peanuts': ['cacahuetes', 'mani', 'cacahuete'],
  'cashews': ['anacardos', 'nueces de la india'],
  'pistachios': ['pistachos', 'pistacho'],
  'hazelnuts': ['avellanas', 'avellana'],
  'pine nuts': ['pinones', 'pinon'],
  'sesame seeds': ['sesamo', 'semillas de sesamo', 'ajonjoli'],
  'chia seeds': ['semillas de chia', 'chia'],
  'flax seeds': ['semillas de lino', 'linaza'],
  'sunflower seeds': ['pipas de girasol', 'semillas de girasol'],
  'pumpkin seeds': ['pipas de calabaza', 'semillas de calabaza'],

  // Baking
  'baking powder': ['levadura quimica', 'polvo de hornear', 'impulsor'],
  'baking soda': ['bicarbonato', 'bicarbonato de sodio'],
  'yeast': ['levadura', 'levadura fresca', 'levadura seca'],
  'cornstarch': ['maicena', 'almidon de maiz', 'fecula de maiz'],
  'cocoa powder': ['cacao en polvo', 'cacao'],
  'chocolate': ['chocolate', 'chocolate negro'],
  'dark chocolate': ['chocolate negro', 'chocolate amargo'],
  'milk chocolate': ['chocolate con leche'],
  'white chocolate': ['chocolate blanco'],
  'chocolate chips': ['pepitas de chocolate', 'chips de chocolate', 'gotas de chocolate'],

  // Canned Goods
  'canned tuna': ['atun en conserva', 'atun enlatado', 'atun en aceite'],
  'canned beans': ['judias en conserva', 'alubias cocidas', 'frijoles enlatados'],
  'canned corn': ['maiz en conserva', 'maiz dulce enlatado'],
  'canned chickpeas': ['garbanzos cocidos', 'garbanzos en conserva'],

  // Beverages
  'coffee': ['cafe', 'cafe molido', 'cafe en grano'],
  'tea': ['te', 'infusion'],
  'wine': ['vino', 'vino tinto', 'vino blanco'],
  'red wine': ['vino tinto'],
  'white wine': ['vino blanco'],
  'beer': ['cerveza'],
  'juice': ['zumo', 'jugo'],
  'orange juice': ['zumo de naranja', 'jugo de naranja'],

  // Other
  'stock': ['caldo', 'caldo de pollo', 'caldo de carne'],
  'chicken stock': ['caldo de pollo'],
  'beef stock': ['caldo de carne', 'caldo de ternera'],
  'vegetable stock': ['caldo de verduras'],
  'broth': ['caldo', 'consomme'],
  'tofu': ['tofu', 'queso de soja'],
  'tempeh': ['tempeh'],
  'coconut milk': ['leche de coco'],
  'almond milk': ['leche de almendras', 'bebida de almendra'],
  'oat milk': ['leche de avena', 'bebida de avena'],
  'soy milk': ['leche de soja', 'bebida de soja']
} as const;

/**
 * Category translations for Spanish supermarkets
 */
export const CATEGORY_TRANSLATIONS: Record<string, readonly string[]> = {
  'produce': ['frutas y verduras', 'verduras', 'frutas', 'hortalizas', 'fruteria'],
  'dairy': ['lacteos', 'leche', 'quesos', 'yogures', 'productos lacteos'],
  'meat': ['carnes', 'carniceria', 'carne fresca', 'aves', 'vacuno', 'cerdo'],
  'seafood': ['pescaderia', 'pescado', 'mariscos', 'pescado fresco', 'congelados mar'],
  'bakery': ['panaderia', 'pan', 'bolleria', 'pasteleria'],
  'frozen': ['congelados', 'productos congelados'],
  'canned': ['conservas', 'enlatados', 'productos en conserva'],
  'dry_goods': ['pasta y arroz', 'legumbres', 'cereales', 'despensa'],
  'condiments': ['salsas', 'condimentos', 'aceites', 'vinagres'],
  'spices': ['especias', 'hierbas', 'condimentos', 'aliños'],
  'beverages': ['bebidas', 'refrescos', 'zumos', 'agua'],
  'other': ['otros', 'varios', 'miscelanea']
} as const;

/**
 * Common preparation terms to remove from ingredient searches
 */
export const PREPARATION_TERMS: readonly string[] = [
  // English
  'diced', 'minced', 'chopped', 'sliced', 'crushed', 'ground', 'grated',
  'fresh', 'dried', 'frozen', 'canned', 'cooked', 'raw', 'peeled',
  'deveined', 'boneless', 'skinless', 'filleted', 'cubed', 'julienned',
  'shredded', 'mashed', 'pureed', 'roasted', 'toasted', 'blanched',
  'large', 'medium', 'small', 'whole', 'half', 'quartered',
  'finely', 'coarsely', 'roughly', 'thinly', 'thickly', 'freshly',
  // Spanish
  'picado', 'troceado', 'cortado', 'en rodajas', 'rallado', 'molido',
  'fresco', 'seco', 'congelado', 'enlatado', 'cocido', 'crudo', 'pelado',
  'deshuesado', 'sin piel', 'fileteado', 'en cubos', 'en juliana',
  'desmenuzado', 'en pure', 'asado', 'tostado',
  'grande', 'mediano', 'pequeno', 'entero', 'medio', 'en cuartos',
  'finamente', 'groseramente'
] as const;

/**
 * Quantity-related words to remove from searches
 */
export const QUANTITY_TERMS: readonly string[] = [
  // English
  'approximately', 'about', 'around', 'roughly', 'handful', 'bunch',
  'clove', 'cloves', 'sprig', 'sprigs', 'stalk', 'stalks',
  // Spanish
  'aproximadamente', 'unos', 'unas', 'manojo', 'diente', 'dientes',
  'ramita', 'ramitas', 'tallo', 'tallos'
] as const;

/**
 * Get Spanish translations for an English ingredient
 * @param englishIngredient - The English ingredient name
 * @returns Array of Spanish translations, or empty array if not found
 */
export function getSpanishTranslations(englishIngredient: string): readonly string[] {
  const normalized = englishIngredient.toLowerCase().trim();

  // Direct lookup
  if (INGREDIENT_MAP[normalized]) {
    return INGREDIENT_MAP[normalized];
  }

  // Try without plural 's'
  if (normalized.endsWith('s') && INGREDIENT_MAP[normalized.slice(0, -1)]) {
    return INGREDIENT_MAP[normalized.slice(0, -1)];
  }

  // Try with 's' added
  if (INGREDIENT_MAP[normalized + 's']) {
    return INGREDIENT_MAP[normalized + 's'];
  }

  // Partial match - check if the ingredient contains a key word
  for (const [key, translations] of Object.entries(INGREDIENT_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return translations;
    }
  }

  return [];
}

/**
 * Get all possible search terms for an ingredient (both English and Spanish)
 * @param ingredientName - The ingredient name (can be English or Spanish)
 * @returns Array of all search terms to try
 */
export function getAllSearchTerms(ingredientName: string): string[] {
  const normalized = ingredientName.toLowerCase().trim();
  const terms = new Set<string>();

  // Add the original term
  terms.add(normalized);

  // Add Spanish translations if we have them
  const spanishTerms = getSpanishTranslations(normalized);
  spanishTerms.forEach(term => terms.add(term));

  // Check if it's already Spanish - try to find English equivalent
  for (const [english, spanish] of Object.entries(INGREDIENT_MAP)) {
    if (spanish.some(s => s.includes(normalized) || normalized.includes(s))) {
      terms.add(english);
      spanish.forEach(s => terms.add(s));
    }
  }

  // Add singular/plural variants
  if (normalized.endsWith('s')) {
    terms.add(normalized.slice(0, -1));
  } else {
    terms.add(normalized + 's');
  }

  return Array.from(terms);
}

/**
 * Normalize an ingredient name by removing preparation and quantity terms
 * @param ingredientName - The raw ingredient name
 * @returns Normalized ingredient name
 */
export function normalizeIngredientName(ingredientName: string): string {
  let normalized = ingredientName.toLowerCase().trim();

  // Remove preparation terms
  for (const term of PREPARATION_TERMS) {
    normalized = normalized.replace(new RegExp(`\\b${term}\\b`, 'gi'), '');
  }

  // Remove quantity terms
  for (const term of QUANTITY_TERMS) {
    normalized = normalized.replace(new RegExp(`\\b${term}\\b`, 'gi'), '');
  }

  // Remove numbers and common quantity patterns
  normalized = normalized
    .replace(/\d+([.,]\d+)?\s*(g|kg|ml|l|oz|lb|cup|cups|tbsp|tsp|tablespoon|teaspoon)s?\b/gi, '')
    .replace(/\d+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized;
}

/**
 * Extract key terms from an ingredient name for matching
 * @param ingredientName - The ingredient name
 * @returns Array of key terms
 */
export function extractKeyTerms(ingredientName: string): string[] {
  const normalized = normalizeIngredientName(ingredientName);
  const words = normalized.split(' ').filter(w => w.length > 2);

  // Filter out common articles and prepositions
  const stopWords = new Set([
    'the', 'a', 'an', 'of', 'for', 'with', 'and', 'or',
    'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'con', 'y', 'o', 'para', 'en'
  ]);

  return words.filter(w => !stopWords.has(w));
}

/**
 * Calculate similarity between two strings using Levenshtein distance
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Similarity score between 0 and 1
 */
export function calculateStringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  // Handle empty strings first
  if (s1.length === 0 && s2.length === 0) return 0;
  if (s1.length === 0 || s2.length === 0) return 0;
  if (s1 === s2) return 1;

  // Create matrix
  const matrix: number[][] = [];
  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= s2.length; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  const distance = matrix[s1.length][s2.length];
  const maxLength = Math.max(s1.length, s2.length);

  return 1 - distance / maxLength;
}

/**
 * Check if two strings are similar within a threshold
 * @param str1 - First string
 * @param str2 - Second string
 * @param threshold - Minimum similarity (default 0.7)
 * @returns True if strings are similar
 */
export function areStringsSimilar(str1: string, str2: string, threshold: number = 0.7): boolean {
  return calculateStringSimilarity(str1, str2) >= threshold;
}

/**
 * Get Spanish category translations for an English category
 * @param category - The English category name
 * @returns Array of Spanish category names
 */
export function getSpanishCategories(category: string): readonly string[] {
  const normalized = category.toLowerCase().replace('_', ' ');
  return CATEGORY_TRANSLATIONS[normalized] || [];
}
