# RFC: Recomendación Inteligente de Planes de Comida con IA

**Autor:** AI Design Team  
**Fecha:** Febrero 2025  
**Estado:** Draft  
**Versión:** 1.0

---

## Resumen Ejecutivo

Este documento propone la integración de inteligencia artificial en MealMate para transformar la generación de planes de comida de un sistema basado en reglas simples a uno verdaderamente personalizado e inteligente.

### Problema Actual

El sistema actual (`POST /meal-plans/generate`) selecciona recetas de forma **aleatoria** entre las disponibles:

```typescript
// Código actual - selección aleatoria
const recipeIndex = Math.floor(Math.random() * availableRecipes.length);
const recipe = availableRecipes[recipeIndex];
```

Esto resulta en:
- Planes de comida sin coherencia nutricional
- Falta de variedad real (puede repetir ingredientes base)
- Ignorancia del contexto (temporada, ofertas, historial del usuario)
- Experiencia genérica que no mejora con el uso

### Solución Propuesta

Implementar un sistema híbrido que combine:
1. **LLM (abstracción multi-proveedor)** para razonamiento y personalización
2. **Embeddings** para búsqueda semántica de recetas similares
3. **Reglas de negocio** para restricciones duras (presupuesto, alergias)

### Estrategia de Modelos por Fase

| Fase | LLM Principal | Embeddings | Coste estimado |
|------|---------------|------------|----------------|
| **MVP/Beta** | Groq (Llama 3.1 70B) | Supabase pgvector + local | **$0/mes** |
| **Validación** | Google Gemini 1.5 Flash | Google Embeddings | **~$50/mes** |
| **Producción** | Claude 3.5 Sonnet | OpenAI text-embedding-3 | **~$800/mes** @ 10K usuarios |

La arquitectura incluye una **capa de abstracción** que permite cambiar de proveedor con una variable de entorno.

### Impacto Esperado

| Métrica | Actual | Objetivo |
|---------|--------|----------|
| Satisfacción usuario (NPS) | N/A | 50+ |
| Tasa de modificación manual | ~60% | <20% |
| Planes completados/generados | ~40% | >70% |
| Tiempo hasta primer plan | ~5 min | <1 min |

---

## Casos de Uso Detallados

### CU-1: Generación Inteligente de Meal Plan Semanal

**Actor:** Usuario autenticado  
**Trigger:** Usuario solicita generar un plan semanal  
**Flujo Principal:**

1. Usuario indica fechas y preferencias básicas
2. Sistema recopila contexto del usuario:
   - Perfil y restricciones dietéticas
   - Historial de planes anteriores (últimos 30 días)
   - Recetas favoritas y evitadas
   - Preferencias de tiempo de preparación
3. IA analiza contexto y genera plan considerando:
   - Variedad de proteínas a lo largo de la semana
   - Balance nutricional diario
   - Reutilización inteligente de ingredientes (reduce desperdicio)
   - Dificultad progresiva (más fácil entre semana)
4. Sistema presenta plan con explicación de elecciones
5. Usuario puede aceptar, modificar o regenerar

**Datos de Entrada para IA:**
```json
{
  "user_context": {
    "household_size": 4,
    "dietary_restrictions": ["gluten_free"],
    "skill_level": "intermediate",
    "weekly_budget_cents": 15000,
    "max_prep_time_minutes": 45,
    "cuisine_preferences": ["mediterranean", "spanish"],
    "disliked_ingredients": ["cilantro", "olives"]
  },
  "temporal_context": {
    "season": "winter",
    "week_start": "2025-02-17",
    "holidays": [],
    "special_events": []
  },
  "behavioral_context": {
    "recent_recipes": ["recipe-id-1", "recipe-id-2"],
    "favorite_recipes": ["recipe-id-3"],
    "completion_rate": 0.75
  },
  "constraints": {
    "meals_per_day": ["lunch", "dinner"],
    "include_meal_prep": true,
    "variety_level": "high"
  }
}
```

### CU-2: Sugerencia de Receta Individual

**Actor:** Usuario navegando recetas  
**Trigger:** Usuario ve una receta y quiere alternativas  
**Flujo Principal:**

1. Usuario visualiza receta actual
2. Solicita "Ver similares" o "Alternativas"
3. Sistema usa embeddings para encontrar recetas semánticamente similares
4. IA rankea considerando:
   - Similitud de perfil de sabor
   - Ingredientes disponibles
   - Tiempo de preparación similar
   - Historial del usuario
5. Presenta 3-5 alternativas con explicación de similitud

### CU-3: Optimización por Presupuesto

**Actor:** Usuario con presupuesto limitado  
**Trigger:** Usuario establece límite de presupuesto  
**Flujo Principal:**

1. Usuario define presupuesto semanal máximo
2. IA genera plan inicial
3. Sistema verifica coste estimado con precios del supermercado seleccionado
4. Si excede presupuesto:
   - IA sugiere sustituciones más económicas
   - Prioriza ingredientes en oferta
   - Propone recetas de temporada (más baratas)
5. Usuario acepta sustituciones o ajusta presupuesto

### CU-4: Adaptación a Restricciones Dietéticas Complejas

**Actor:** Usuario con múltiples restricciones  
**Trigger:** Usuario con restricciones combinadas (ej: vegano + sin gluten + bajo en FODMAP)  
**Flujo Principal:**

1. Usuario configura restricciones en perfil
2. Sistema filtra recetas compatibles
3. Si el pool es muy limitado (<20 recetas):
   - IA sugiere adaptaciones a recetas populares
   - Genera instrucciones de sustitución
4. Plan incluye notas específicas de adaptación

### CU-5: Recomendación Contextual por Temporada

**Actor:** Sistema (automático)  
**Trigger:** Cambio de temporada o proximidad de festividades  
**Flujo Principal:**

1. Sistema detecta contexto temporal
2. Ajusta ranking de recetas según:
   - Ingredientes de temporada (más frescos, más baratos)
   - Recetas tradicionales por festividad
   - Preferencias climáticas (sopas en invierno, ensaladas en verano)
3. Usuario ve recomendaciones contextuales en dashboard

### CU-6: Aprendizaje del Feedback

**Actor:** Usuario después de completar plan  
**Trigger:** Fin de semana de meal plan  
**Flujo Principal:**

1. Sistema solicita feedback rápido:
   - "¿Qué recetas repetirías?"
   - "¿Alguna fue demasiado difícil?"
   - "¿Algún ingrediente sobró?"
2. Usuario responde (opcional)
3. Sistema actualiza perfil de preferencias
4. Próximos planes reflejan aprendizaje

---

## Arquitectura Técnica Propuesta

### Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                          │
├─────────────────────────────────────────────────────────────────────┤
│  MealPlanGenerator  │  RecipeExplorer  │  PreferencesManager        │
└──────────┬──────────┴────────┬─────────┴──────────┬─────────────────┘
           │                   │                    │
           ▼                   ▼                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         API Layer (Hono)                            │
├─────────────────────────────────────────────────────────────────────┤
│  POST /ai/meal-plans/generate                                       │
│  POST /ai/recipes/recommend                                         │
│  POST /ai/meal-plans/:id/optimize                                   │
│  POST /ai/feedback                                                  │
└──────────┬──────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      AI Service Layer                               │
├─────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────┐ │
│  │ MealPlanAIService  │  │   PromptBuilder    │  │EmbeddingService│ │
│  │ - generatePlan()   │  │ - buildPrompt()    │  │ - findSimilar()│ │
│  │ - optimizeBudget() │  │ - parseResponse()  │  │ - search()     │ │
│  └─────────┬──────────┘  └────────────────────┘  └────────────────┘ │
│            │                                                        │
│            ▼                                                        │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │         🔌 LLMClient (Abstracción Multi-Proveedor)           │   │
│  │  ┌────────────────────────────────────────────────────────┐  │   │
│  │  │ interface LLMClient {                                  │  │   │
│  │  │   complete(messages, options): Promise<Response>       │  │   │
│  │  │   healthCheck(): Promise<boolean>                      │  │   │
│  │  │ }                                                      │  │   │
│  │  └────────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         ▼                     ▼                     ▼
   ┌───────────┐         ┌───────────┐         ┌───────────┐
   │   Groq    │         │  Google   │         │ Anthropic │
   │  ⭐ MVP   │         │  Gemini   │         │  Claude   │
   │   FREE    │ ──────▶ │   FREE    │ ──────▶ │   PAID    │
   │ Llama 3.1 │         │   Flash   │         │  Sonnet   │
   └───────────┘         └───────────┘         └───────────┘
    Meses 1-3             Meses 4-6              Mes 7+
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Data Layer (Supabase FREE)                       │
├─────────────────────────────────────────────────────────────────────┤
│  PostgreSQL + pgvector (incluido gratis)                            │
│  - recipes (existing)                                               │
│  - recipe_embeddings (new) ← gte-small embeddings (FREE)            │
│  - user_preferences_history (new)                                   │
│  - ai_generation_logs (new)                                         │
└─────────────────────────────────────────────────────────────────────┘
```

### Estrategia de Modelos: MVP Gratuito → Producción

#### Filosofía: Validar Primero, Escalar Después

La arquitectura está diseñada con una **capa de abstracción** que permite:
1. Empezar con proveedores gratuitos para validar el producto
2. Migrar a modelos premium cuando el negocio lo justifique
3. Cambiar de proveedor con **una variable de entorno**

---

#### Comparativa de Proveedores LLM

##### Opciones Gratuitas (MVP/Beta)

| Proveedor | Modelo | Tier Gratuito | Límites | Calidad Español | Latencia |
|-----------|--------|---------------|---------|-----------------|----------|
| **Groq** ⭐ | Llama 3.1 70B | ✅ Gratis | 30 req/min, 14.4K tokens/min | ⭐⭐⭐⭐ Muy buena | ⚡ ~0.5s |
| **Groq** | Llama 3.3 70B | ✅ Gratis | 30 req/min | ⭐⭐⭐⭐ Muy buena | ⚡ ~0.5s |
| **Google Gemini** | Gemini 1.5 Flash | ✅ Gratis | 15 req/min, 1M tokens/día | ⭐⭐⭐⭐ Muy buena | ~1-2s |
| **Google Gemini** | Gemini 2.0 Flash | ✅ Gratis | 10 req/min | ⭐⭐⭐⭐⭐ Excelente | ~1s |
| **Mistral** | Mistral Small | ✅ Gratis | 1 req/s, 500K tokens/mes | ⭐⭐⭐⭐ Buena | ~1-2s |
| **Cloudflare** | Llama 3.1 8B | ✅ Gratis | 10K tokens/día | ⭐⭐⭐ Aceptable | ~2s |
| **OpenRouter** | Varios | ✅ Gratis* | Créditos limitados | Variable | Variable |

*OpenRouter ofrece algunos modelos gratuitos y créditos iniciales.

##### Opciones de Pago (Producción)

| Proveedor | Modelo | Precio Input | Precio Output | Calidad Español | Contexto |
|-----------|--------|--------------|---------------|-----------------|----------|
| **Anthropic** ⭐ | Claude 3.5 Sonnet | $3/M tokens | $15/M tokens | ⭐⭐⭐⭐⭐ Excelente | 200K |
| **Anthropic** | Claude 3.5 Haiku | $0.25/M | $1.25/M | ⭐⭐⭐⭐ Muy buena | 200K |
| **OpenAI** | GPT-4o | $2.50/M | $10/M | ⭐⭐⭐⭐ Muy buena | 128K |
| **OpenAI** | GPT-4o-mini | $0.15/M | $0.60/M | ⭐⭐⭐⭐ Buena | 128K |
| **Google** | Gemini 1.5 Pro | $1.25/M | $5/M | ⭐⭐⭐⭐⭐ Excelente | 2M |

---

#### Recomendación por Fase

##### 🚀 Fase MVP (Meses 1-3): **Groq + Llama 3.1 70B**

**¿Por qué Groq?**
- **100% gratuito** sin tarjeta de crédito
- **Latencia ultrarrápida** (~500ms vs 2-3s de otros)
- Llama 3.1 70B tiene excelente español y JSON output
- Rate limits generosos para MVP (30 req/min = ~43K req/día)

```typescript
// Configuración MVP
LLM_PROVIDER=groq
LLM_MODEL=llama-3.1-70b-versatile
```

**Limitaciones aceptables para MVP:**
- Sin function calling nativo (se soluciona con prompts estructurados)
- Contexto de 128K (suficiente para nuestro caso)

##### 📈 Fase Validación (Meses 4-6): **Google Gemini 1.5 Flash**

**¿Por qué Gemini?**
- Tier gratuito muy generoso (1M tokens/día)
- Excelente calidad en español
- Function calling nativo
- Si necesitas escalar: pricing muy competitivo

```typescript
// Configuración Validación
LLM_PROVIDER=google
LLM_MODEL=gemini-1.5-flash
```

##### 🏢 Fase Producción (Mes 7+): **Claude 3.5 Sonnet/Haiku**

**¿Por qué Claude?**
- Mejor reasoning para planificación compleja
- Español nativo de alta calidad
- Mejor seguimiento de instrucciones (menos alucinaciones)
- Claude Haiku para tareas simples (80% más barato)

```typescript
// Configuración Producción
LLM_PROVIDER=anthropic
LLM_MODEL=claude-3-5-sonnet-20241022
LLM_MODEL_FAST=claude-3-5-haiku-20241022  // Para recomendaciones simples
```

---

#### Comparativa de Embeddings

| Proveedor | Modelo | Tier Gratuito | Dimensiones | Calidad Español |
|-----------|--------|---------------|-------------|-----------------|
| **Supabase** ⭐ | gte-small (local) | ✅ Incluido | 384 | ⭐⭐⭐ Buena |
| **Hugging Face** | multilingual-e5 | ✅ Gratis | 768 | ⭐⭐⭐⭐ Muy buena |
| **OpenAI** | text-embedding-3-small | $0.02/M | 1536 | ⭐⭐⭐⭐⭐ Excelente |
| **Google** | text-embedding-004 | Gratis (límites) | 768 | ⭐⭐⭐⭐ Muy buena |
| **Cohere** | embed-multilingual-v3 | 100 req/min gratis | 1024 | ⭐⭐⭐⭐ Muy buena |

**Recomendación:** 
- **MVP**: Supabase gte-small (ya incluido, cero coste)
- **Producción**: OpenAI text-embedding-3-small ($0.02/M tokens = casi gratis)

---

### Arquitectura de Abstracción LLM

La clave para migrar fácilmente entre proveedores es una **interfaz común**:

```typescript
// src/core/src/services/llm/types.ts

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
  stop?: string[];
}

export interface LLMCompletionResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  finishReason: 'stop' | 'length' | 'error';
}

export interface LLMClient {
  /** Nombre del proveedor para logging */
  readonly provider: string;
  
  /** Completa un prompt y devuelve la respuesta */
  complete(
    messages: LLMMessage[],
    options?: LLMCompletionOptions
  ): Promise<LLMCompletionResponse>;
  
  /** Streaming de respuesta (opcional) */
  stream?(
    messages: LLMMessage[],
    options?: LLMCompletionOptions
  ): AsyncIterable<string>;
  
  /** Verifica que el cliente esté configurado correctamente */
  healthCheck(): Promise<boolean>;
}
```

#### Implementación: Cliente Groq (MVP)

```typescript
// src/core/src/services/llm/clients/groq.client.ts

import Groq from 'groq-sdk';
import type { LLMClient, LLMMessage, LLMCompletionOptions, LLMCompletionResponse } from '../types.js';

export class GroqClient implements LLMClient {
  readonly provider = 'groq';
  private client: Groq;
  private defaultModel: string;

  constructor(apiKey: string, model = 'llama-3.1-70b-versatile') {
    this.client = new Groq({ apiKey });
    this.defaultModel = model;
  }

  async complete(
    messages: LLMMessage[],
    options?: LLMCompletionOptions
  ): Promise<LLMCompletionResponse> {
    const response = await this.client.chat.completions.create({
      model: options?.model ?? this.defaultModel,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 4096,
      response_format: options?.responseFormat === 'json' 
        ? { type: 'json_object' } 
        : undefined,
      stop: options?.stop,
    });

    const choice = response.choices[0];
    
    return {
      content: choice.message.content ?? '',
      usage: {
        promptTokens: response.usage?.prompt_tokens ?? 0,
        completionTokens: response.usage?.completion_tokens ?? 0,
        totalTokens: response.usage?.total_tokens ?? 0,
      },
      model: response.model,
      finishReason: choice.finish_reason === 'stop' ? 'stop' : 'length',
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.complete([{ role: 'user', content: 'ping' }], { maxTokens: 5 });
      return true;
    } catch {
      return false;
    }
  }
}
```

#### Factory con Fallback Automático

```typescript
// src/core/src/services/llm/llm.factory.ts

import { GroqClient } from './clients/groq.client.js';
import { GoogleClient } from './clients/google.client.js';
import { AnthropicClient } from './clients/anthropic.client.js';
import { MistralClient } from './clients/mistral.client.js';
import type { LLMClient } from './types.js';

export type LLMProvider = 'groq' | 'google' | 'anthropic' | 'mistral' | 'openrouter';

const PROVIDER_CONFIGS: Record<LLMProvider, { envKey: string; defaultModel: string }> = {
  groq: { envKey: 'GROQ_API_KEY', defaultModel: 'llama-3.1-70b-versatile' },
  google: { envKey: 'GOOGLE_AI_API_KEY', defaultModel: 'gemini-1.5-flash' },
  anthropic: { envKey: 'ANTHROPIC_API_KEY', defaultModel: 'claude-3-5-sonnet-20241022' },
  mistral: { envKey: 'MISTRAL_API_KEY', defaultModel: 'mistral-small-latest' },
  openrouter: { envKey: 'OPENROUTER_API_KEY', defaultModel: 'meta-llama/llama-3.1-70b-instruct' },
};

export function createLLMClient(provider?: LLMProvider): LLMClient {
  const selectedProvider = provider ?? (process.env.LLM_PROVIDER as LLMProvider) ?? 'groq';
  const config = PROVIDER_CONFIGS[selectedProvider];
  const apiKey = process.env[config.envKey];
  const model = process.env.LLM_MODEL ?? config.defaultModel;
  
  if (!apiKey) {
    throw new Error(`Missing API key: ${config.envKey}`);
  }
  
  switch (selectedProvider) {
    case 'groq':
      return new GroqClient(apiKey, model);
    case 'google':
      return new GoogleClient(apiKey, model);
    case 'anthropic':
      return new AnthropicClient(apiKey, model);
    case 'mistral':
      return new MistralClient(apiKey, model);
    default:
      throw new Error(`Unknown LLM provider: ${selectedProvider}`);
  }
}

/** Servicio con fallback automático */
export class LLMService {
  private primaryClient: LLMClient;
  private fallbackClient?: LLMClient;

  constructor(primaryProvider?: LLMProvider, fallbackProvider?: LLMProvider) {
    this.primaryClient = createLLMClient(primaryProvider);
    
    if (fallbackProvider) {
      try {
        this.fallbackClient = createLLMClient(fallbackProvider);
      } catch (e) {
        console.warn(`Fallback provider ${fallbackProvider} not configured`);
      }
    }
  }

  async complete(
    messages: LLMMessage[],
    options?: LLMCompletionOptions
  ): Promise<LLMCompletionResponse> {
    try {
      return await this.primaryClient.complete(messages, options);
    } catch (error) {
      console.error(`Primary LLM (${this.primaryClient.provider}) failed:`, error);
      
      if (this.fallbackClient) {
        console.log(`Falling back to ${this.fallbackClient.provider}`);
        return await this.fallbackClient.complete(messages, options);
      }
      
      throw error;
    }
  }

  get provider(): string {
    return this.primaryClient.provider;
  }
}
```

#### Configuración por Entorno

```bash
# .env.development (MVP - 100% GRATIS)
LLM_PROVIDER=groq
LLM_MODEL=llama-3.1-70b-versatile
GROQ_API_KEY=gsk_xxxxxxxxxxxx

EMBEDDING_PROVIDER=supabase
# Usa el modelo gte-small incluido en Supabase

# .env.staging (Validación - Gratis con límites generosos)
LLM_PROVIDER=google
LLM_MODEL=gemini-1.5-flash
GOOGLE_AI_API_KEY=AIzaxxxxxxxx
LLM_FALLBACK_PROVIDER=groq
GROQ_API_KEY=gsk_xxxxxxxxxxxx

EMBEDDING_PROVIDER=google

# .env.production (Pago - Mejor calidad)
LLM_PROVIDER=anthropic
LLM_MODEL=claude-3-5-sonnet-20241022
ANTHROPIC_API_KEY=sk-ant-xxxxxxxx
LLM_FAST_MODEL=claude-3-5-haiku-20241022
LLM_FALLBACK_PROVIDER=google

EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=sk-xxxxxxxx
```

#### Uso en el Servicio de Meal Plans

```typescript
// src/core/src/services/meal-plan-ai.service.ts

import { LLMService } from './llm/llm.factory.js';
import { PromptBuilder } from './prompts/prompt-builder.js';

export class MealPlanAIService {
  private llm: LLMService;
  private promptBuilder: PromptBuilder;

  constructor() {
    // Automáticamente usa el proveedor configurado en .env
    this.llm = new LLMService(
      process.env.LLM_PROVIDER as LLMProvider,
      process.env.LLM_FALLBACK_PROVIDER as LLMProvider
    );
    this.promptBuilder = new PromptBuilder();
  }

  async generateMealPlan(context: MealPlanContext): Promise<GeneratedMealPlan> {
    const { systemPrompt, userPrompt } = this.promptBuilder.buildMealPlanPrompt(context);
    
    const response = await this.llm.complete([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], {
      temperature: 0.7,
      maxTokens: 4000,
      responseFormat: 'json',
    });

    // Parsear y validar respuesta...
    return this.parseAndValidateResponse(response.content, context);
  }
}
```

---

### Flujo de Datos: Generación de Meal Plan

```
[Usuario solicita plan]
         │
         ▼
┌─────────────────────────────────────┐
│ 1. Recopilar contexto               │
│    - UserProfile                    │
│    - RecentMealPlans (30 días)      │
│    - FavoriteRecipes                │
│    - SeasonalContext                │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│ 2. Pre-filtrado de recetas          │
│    - Aplicar restricciones duras    │
│    - Filtrar por tiempo prep        │
│    - Excluir usadas recientemente   │
│    → Pool de ~50-100 recetas        │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│ 3. Enriquecer con embeddings        │
│    - Calcular diversidad de pool    │
│    - Agrupar por similitud          │
│    → Clusters de recetas            │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│ 4. Construir prompt                 │
│    - System: Rol + restricciones    │
│    - User: Contexto + pool recetas  │
│    - Output: JSON estructurado      │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│ 5. Llamada a Claude API             │
│    - Modelo: claude-3-5-sonnet      │
│    - Max tokens: 4000               │
│    - Temperature: 0.7               │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│ 6. Post-procesamiento               │
│    - Validar JSON response          │
│    - Verificar recetas existen      │
│    - Calcular métricas nutricionales│
│    - Estimar coste con precios      │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│ 7. Persistir y responder            │
│    - Guardar meal_plan              │
│    - Guardar entries                │
│    - Log para analytics             │
│    - Retornar al usuario            │
└─────────────────────────────────────┘
```

---

## Modelo de Datos (Cambios)

### Nuevas Tablas

```sql
-- Embeddings de recetas para búsqueda semántica
CREATE TABLE recipe_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    embedding vector(1536) NOT NULL,
    embedding_model VARCHAR(100) NOT NULL DEFAULT 'text-embedding-3-small',
    content_hash VARCHAR(64) NOT NULL, -- Para detectar cambios
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(recipe_id)
);

-- Índice para búsqueda por similitud
CREATE INDEX recipe_embeddings_idx ON recipe_embeddings 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Historial de preferencias del usuario (para aprendizaje)
CREATE TABLE user_preference_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    signal_type VARCHAR(50) NOT NULL, -- 'recipe_completed', 'recipe_skipped', 'rating', 'favorite', 'dislike'
    recipe_id UUID REFERENCES recipes(id),
    meal_plan_id UUID REFERENCES meal_plans(id),
    signal_value DECIMAL(3,2), -- Para ratings: 1-5, para otros: 1.0 o -1.0
    context JSONB, -- Metadatos adicionales
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX user_pref_signals_user_idx ON user_preference_signals(user_id);
CREATE INDEX user_pref_signals_recipe_idx ON user_preference_signals(recipe_id);
CREATE INDEX user_pref_signals_type_idx ON user_preference_signals(signal_type);

-- Logs de generación IA (analytics y debugging)
CREATE TABLE ai_generation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    request_type VARCHAR(50) NOT NULL, -- 'meal_plan', 'recipe_recommend', 'optimization'
    input_context JSONB NOT NULL, -- Contexto enviado (sin PII)
    model_used VARCHAR(100) NOT NULL,
    prompt_tokens INTEGER NOT NULL,
    completion_tokens INTEGER NOT NULL,
    latency_ms INTEGER NOT NULL,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    output_meal_plan_id UUID REFERENCES meal_plans(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX ai_logs_user_idx ON ai_generation_logs(user_id);
CREATE INDEX ai_logs_type_idx ON ai_generation_logs(request_type);
CREATE INDEX ai_logs_date_idx ON ai_generation_logs(created_at);

-- Plantillas de prompts (para A/B testing y versionado)
CREATE TABLE ai_prompt_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    template_type VARCHAR(50) NOT NULL, -- 'meal_plan_system', 'meal_plan_user', 'optimization'
    content TEXT NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    performance_metrics JSONB, -- CTR, satisfaction scores, etc.
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(name, version)
);
```

### Cambios a Tablas Existentes

```sql
-- Añadir campos a user_profiles
ALTER TABLE user_profiles ADD COLUMN ai_personalization_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE user_profiles ADD COLUMN preferred_ai_creativity DECIMAL(2,1) DEFAULT 0.7; -- Temperature control
ALTER TABLE user_profiles ADD COLUMN meal_plan_feedback_count INTEGER DEFAULT 0;

-- Añadir campos a recipes para IA
ALTER TABLE recipes ADD COLUMN semantic_tags JSONB DEFAULT '[]'; -- Tags inferidos por IA
ALTER TABLE recipes ADD COLUMN complexity_score DECIMAL(3,2); -- 0-1, calculado
ALTER TABLE recipes ADD COLUMN seasonal_months INTEGER[] DEFAULT '{}'; -- Meses óptimos

-- Añadir campos a meal_plans
ALTER TABLE meal_plans ADD COLUMN generated_by VARCHAR(50) DEFAULT 'manual'; -- 'manual', 'ai', 'template'
ALTER TABLE meal_plans ADD COLUMN ai_explanation TEXT; -- Explicación de por qué se eligieron las recetas
ALTER TABLE meal_plans ADD COLUMN user_satisfaction_score DECIMAL(2,1); -- 1-5, post-feedback
```

### Schema Drizzle (TypeScript)

```typescript
// src/api/src/db/schema-ai.ts

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Custom vector type for pgvector
export const vector = (name: string, dimensions: number) => 
  sql`${sql.identifier(name)} vector(${dimensions})`;

export const recipeEmbeddings = pgTable(
  'recipe_embeddings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recipeId: uuid('recipe_id').references(() => recipes.id, { onDelete: 'cascade' }).notNull().unique(),
    // embedding: vector('embedding', 1536), // Handle with raw SQL for pgvector
    embeddingModel: varchar('embedding_model', { length: 100 }).default('text-embedding-3-small'),
    contentHash: varchar('content_hash', { length: 64 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  }
);

export const userPreferenceSignals = pgTable(
  'user_preference_signals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    signalType: varchar('signal_type', { length: 50 }).notNull(),
    recipeId: uuid('recipe_id').references(() => recipes.id),
    mealPlanId: uuid('meal_plan_id').references(() => mealPlans.id),
    signalValue: decimal('signal_value', { precision: 3, scale: 2 }),
    context: jsonb('context').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('user_pref_signals_user_idx').on(table.userId),
    recipeIdx: index('user_pref_signals_recipe_idx').on(table.recipeId),
  })
);

export const aiGenerationLogs = pgTable(
  'ai_generation_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    requestType: varchar('request_type', { length: 50 }).notNull(),
    inputContext: jsonb('input_context').$type<Record<string, unknown>>().notNull(),
    modelUsed: varchar('model_used', { length: 100 }).notNull(),
    promptTokens: integer('prompt_tokens').notNull(),
    completionTokens: integer('completion_tokens').notNull(),
    latencyMs: integer('latency_ms').notNull(),
    success: boolean('success').notNull(),
    errorMessage: text('error_message'),
    outputMealPlanId: uuid('output_meal_plan_id').references(() => mealPlans.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('ai_logs_user_idx').on(table.userId),
    typeIdx: index('ai_logs_type_idx').on(table.requestType),
  })
);
```

---

## API Endpoints Nuevos

### POST /api/ai/meal-plans/generate

Genera un meal plan inteligente usando IA.

**Request:**
```typescript
interface GenerateAIMealPlanRequest {
  startDate: string; // ISO date
  endDate: string;
  preferences?: {
    includeBreakfast?: boolean;
    includeLunch?: boolean;
    includeDinner?: boolean;
    includeSnacks?: boolean;
    variety?: 'low' | 'medium' | 'high';
    preferQuickMeals?: boolean;
    maxPrepTime?: number;
    budgetLimit?: number;
    mealPrepFriendly?: boolean;
  };
  context?: {
    occasion?: string; // 'everyday', 'guests', 'romantic', 'kids_party'
    cuisineFocus?: string[]; // Override profile preferences for this plan
    excludeRecipes?: string[]; // UUIDs to avoid
    includeRecipes?: string[]; // UUIDs to include
  };
}
```

**Response:**
```typescript
interface GenerateAIMealPlanResponse {
  success: true;
  data: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    status: 'draft';
    entries: MealPlanEntry[];
    aiExplanation: string; // "He seleccionado recetas que..."
    summary: {
      totalMeals: number;
      estimatedCost: number;
      nutritionAverage: NutritionSummary;
      ingredientReuse: number; // 0-100% efficiency
      varietyScore: number; // 0-100
    };
    generationMetadata: {
      modelUsed: string;
      tokensUsed: number;
      latencyMs: number;
    };
  };
}
```

**Errores:**
- `400` - Invalid date range or preferences
- `402` - AI quota exceeded (if implementing usage limits)
- `503` - AI service temporarily unavailable

### POST /api/ai/recipes/recommend

Obtiene recomendaciones de recetas basadas en contexto.

**Request:**
```typescript
interface RecipeRecommendRequest {
  context: 
    | { type: 'similar'; recipeId: string; limit?: number }
    | { type: 'forIngredients'; ingredients: string[]; limit?: number }
    | { type: 'forMeal'; mealType: MealType; date: string }
    | { type: 'trending'; limit?: number };
}
```

**Response:**
```typescript
interface RecipeRecommendResponse {
  success: true;
  data: {
    recipes: Array<{
      recipe: RecipeSummary;
      relevanceScore: number;
      matchReason: string;
    }>;
  };
}
```

### POST /api/ai/meal-plans/:id/optimize

Optimiza un meal plan existente (presupuesto, nutrición, etc.).

**Request:**
```typescript
interface OptimizeMealPlanRequest {
  optimizationGoal: 'budget' | 'nutrition' | 'time' | 'variety';
  constraints?: {
    maxBudget?: number;
    targetCalories?: number;
    maxPrepTimePerMeal?: number;
  };
}
```

**Response:**
```typescript
interface OptimizeMealPlanResponse {
  success: true;
  data: {
    originalPlan: MealPlanSummary;
    optimizedPlan: MealPlanSummary;
    changes: Array<{
      day: string;
      mealType: string;
      originalRecipe: string;
      newRecipe: string;
      reason: string;
      savings?: { costCents?: number; minutes?: number; calories?: number };
    }>;
    totalSavings: { costCents?: number; minutes?: number };
  };
}
```

### POST /api/ai/feedback

Registra feedback del usuario para mejorar recomendaciones.

**Request:**
```typescript
interface AIFeedbackRequest {
  mealPlanId?: string;
  recipeId?: string;
  feedbackType: 'rating' | 'completed' | 'skipped' | 'favorite' | 'dislike';
  value?: number; // 1-5 for rating
  comment?: string;
}
```

### GET /api/ai/embeddings/sync

(Admin) Sincroniza embeddings de recetas nuevas/actualizadas.

---

## Estructura de Prompts

### System Prompt: Generación de Meal Plan

```markdown
Eres un nutricionista y chef experto especializado en planificación de comidas para familias españolas. Tu tarea es crear planes de comida semanales personalizados.

## Tus capacidades:
- Conocimiento profundo de la cocina española y mediterránea
- Comprensión de nutrición y balance alimentario
- Sensibilidad a restricciones dietéticas y alergias
- Optimización de ingredientes para reducir desperdicio

## Reglas estrictas:
1. SOLO puedes usar recetas del pool proporcionado (IDs válidos)
2. NUNCA inventes recetas o IDs
3. Respeta TODAS las restricciones dietéticas como críticas
4. El output DEBE ser JSON válido siguiendo el schema exacto

## Criterios de selección:
1. **Variedad proteica**: Alterna entre carne, pescado, huevos, legumbres a lo largo de la semana
2. **Reutilización inteligente**: Si usas pechuga de pollo el lunes, usa sobras para una ensalada el martes
3. **Balance semanal**: No más de 2 platos fritos por semana
4. **Dificultad adaptada**: Recetas más simples entre semana, más elaboradas el fin de semana
5. **Temporada**: Prioriza ingredientes de temporada cuando estén disponibles

## Formato de respuesta:
{
  "mealPlan": {
    "explanation": "Breve explicación de la filosofía del plan (2-3 frases)",
    "days": [
      {
        "date": "YYYY-MM-DD",
        "meals": {
          "breakfast": { "recipeId": "uuid", "servings": N, "notes": "opcional" },
          "lunch": { "recipeId": "uuid", "servings": N },
          "dinner": { "recipeId": "uuid", "servings": N }
        }
      }
    ]
  },
  "shoppingTips": ["tip1", "tip2"],
  "mealPrepSuggestions": ["sugerencia1"]
}
```

### User Prompt Template

```markdown
## Contexto del usuario

**Perfil:**
- Tamaño del hogar: {{householdSize}} personas
- Nivel de cocina: {{cookingSkill}}
- Presupuesto semanal: {{budgetWeekly}}€
- Tiempo máximo de preparación: {{maxPrepTime}} minutos

**Restricciones dietéticas:**
{{#each dietaryRestrictions}}
- {{this}}
{{/each}}

**Preferencias de cocina:**
{{#each cuisinePreferences}}
- {{this}}
{{/each}}

**Ingredientes a evitar:**
{{#each dislikedIngredients}}
- {{this}}
{{/each}}

## Contexto temporal
- Semana del: {{weekStart}} al {{weekEnd}}
- Estación: {{season}}
{{#if holidays}}
- Festividades: {{holidays}}
{{/if}}

## Historial reciente
Recetas usadas en las últimas 2 semanas (evitar repetir):
{{#each recentRecipes}}
- {{name}} ({{id}})
{{/each}}

## Pool de recetas disponibles
{{#each availableRecipes}}
### {{name}}
- ID: {{id}}
- Tiempo: {{prepTime}} + {{cookTime}} min
- Dificultad: {{difficulty}}
- Cocina: {{cuisine}}
- Tags: {{tags}}
- Ingredientes principales: {{mainIngredients}}
{{/each}}

## Tu tarea
Genera un plan de comidas para la semana indicada con:
- {{mealsPerDay}} comidas por día: {{mealTypes}}
- Nivel de variedad: {{varietyLevel}}
{{#if budgetLimit}}
- Ajustado al presupuesto de {{budgetLimit}}€
{{/if}}

Responde SOLO con el JSON estructurado, sin explicaciones adicionales fuera del JSON.
```

---

## Estimación de Esfuerzo

### Fase 1: Infraestructura Base (2 semanas) ✅ COMPLETADA

| Tarea | Estimación | Prioridad | Estado |
|-------|------------|-----------|--------|
| Setup pgvector en Supabase | 2h | P0 | ✅ `scripts/migrate-ai.ts` |
| Migraciones de schema nuevas | 4h | P0 | ✅ `src/db/schema-ai.ts` |
| Servicio de embeddings base | 8h | P0 | ✅ `services/ai/embeddings-service.ts` |
| Job para generar embeddings de recetas existentes | 4h | P0 | ✅ `scripts/embed-recipes.ts` |
| Configuración LLM API + rate limiting (Groq MVP) | 4h | P0 | ✅ `services/ai/llm-client.ts` |
| Servicio AI base (MealPlanAIService) | 16h | P0 | ✅ `services/ai/meal-plan-ai-service.ts` |
| Testing unitario servicios IA | 8h | P0 | ✅ 42 tests passing |
| **Total Fase 1** | **~46h (6 días)** | | ✅ |

### Fase 2: Generación Inteligente (2 semanas)

| Tarea | Estimación | Prioridad |
|-------|------------|-----------|
| Endpoint POST /ai/meal-plans/generate | 8h | P0 |
| PromptBuilder con templates | 6h | P0 |
| Recopilación de contexto del usuario | 6h | P0 |
| Validación y post-procesamiento respuesta IA | 6h | P0 |
| Manejo de errores y fallbacks | 4h | P0 |
| Frontend: UI de generación con IA | 12h | P0 |
| Frontend: Mostrar explicación IA | 4h | P1 |
| Testing E2E generación | 6h | P0 |
| **Total Fase 2** | **~52h (7 días)** | |

### Fase 3: Recomendaciones y Similitud (1.5 semanas)

| Tarea | Estimación | Prioridad |
|-------|------------|-----------|
| Endpoint POST /ai/recipes/recommend | 6h | P1 |
| Búsqueda semántica con embeddings | 8h | P1 |
| Recomendaciones "recetas similares" | 4h | P1 |
| Recomendaciones por ingredientes | 4h | P1 |
| Frontend: Componente de recomendaciones | 8h | P1 |
| Caché de resultados frecuentes | 4h | P2 |
| **Total Fase 3** | **~34h (4.5 días)** | |

### Fase 4: Optimización y Feedback (1.5 semanas)

| Tarea | Estimación | Prioridad |
|-------|------------|-----------|
| Endpoint POST /ai/meal-plans/:id/optimize | 8h | P1 |
| Lógica de optimización por presupuesto | 6h | P1 |
| Integración con precios de supermercado | 4h | P1 |
| Sistema de feedback (endpoint + UI) | 6h | P1 |
| Tabla de señales de preferencia | 4h | P1 |
| Analytics dashboard básico | 8h | P2 |
| **Total Fase 4** | **~36h (4.5 días)** | |

### Fase 5: Refinamiento y Lanzamiento (1 semana)

| Tarea | Estimación | Prioridad |
|-------|------------|-----------|
| A/B testing de prompts | 6h | P2 |
| Monitorización y alertas | 4h | P1 |
| Documentación de API | 4h | P1 |
| Rate limiting por usuario | 4h | P1 |
| Feature flags para rollout gradual | 4h | P1 |
| Testing de carga | 4h | P2 |
| **Total Fase 5** | **~26h (3.5 días)** | |

### Resumen Total

| Fase | Duración | Horas |
|------|----------|-------|
| Fase 1: Infraestructura | 2 semanas | 46h |
| Fase 2: Generación | 2 semanas | 52h |
| Fase 3: Recomendaciones | 1.5 semanas | 34h |
| Fase 4: Optimización | 1.5 semanas | 36h |
| Fase 5: Refinamiento | 1 semana | 26h |
| **TOTAL** | **~8 semanas** | **~194h** |

---

## Consideraciones de Coste

### Costes Fase MVP

| Concepto | Coste |
|----------|-------|
| Groq API | **$0** (tier gratuito) |
| Embeddings (HF) | **$0** (tier gratuito) |
| Supabase | $0-25/mes |
| Vercel | $0-20/mes |
| **Total MVP** | **$0-45/mes** |

### 🚀 Costes por Fase de Desarrollo

#### Fase MVP (Meses 1-3): **COSTE CERO en IA**

| Concepto | Proveedor | Coste |
|----------|-----------|-------|
| LLM (Llama 3.1 70B) | Groq | **$0** (gratis) |
| Embeddings | Supabase gte-small | **$0** (incluido) |
| Base de datos | Supabase Free | **$0** |
| Hosting | Vercel Free | **$0** |
| **Total MVP** | | **$0/mes** |

**Límites del tier gratuito:**
- Groq: 30 req/min, 14.4K tokens/min → ~500-1000 usuarios activos/día
- Supabase Free: 500MB storage, 2GB bandwidth → suficiente para MVP

#### Fase Validación (Meses 4-6): **~$50-100/mes**

| Concepto | Proveedor | Coste estimado |
|----------|-----------|----------------|
| LLM (Gemini 1.5 Flash) | Google | ~$20-50/mes* |
| Embeddings | Supabase/Google | $0-10/mes |
| Base de datos | Supabase Pro | $25/mes |
| Hosting | Vercel Pro | $20/mes |
| **Total Validación** | | **~$65-105/mes** |

*Google Gemini tier gratuito cubre mucho; el coste estimado es por si se exceden límites.

#### Fase Producción (Mes 7+): **Escala con usuarios**

| Concepto | Tokens/llamada | Llamadas/mes | Coste/mes |
|----------|----------------|--------------|-----------|
| Claude 3.5 Sonnet (input) | ~3,000 | 4/usuario | $0.036/usuario |
| Claude 3.5 Sonnet (output) | ~800 | 4/usuario | $0.048/usuario |
| OpenAI Embeddings | ~500 | 8/usuario | $0.0001/usuario |
| **Total por usuario** | | | **~$0.08/mes** |

**Proyección a escala (Producción):**

| Usuarios activos | Coste mensual IA | Coste infra | Total |
|------------------|------------------|-------------|-------|
| 1,000 | ~$80 | ~$70 | ~$150 |
| 10,000 | ~$800 | ~$150 | ~$950 |
| 50,000 | ~$4,000 | ~$400 | ~$4,400 |
| 100,000 | ~$8,000 | ~$800 | ~$8,800 |

### Comparativa: Coste por Proveedor LLM

| Proveedor | Coste 1K usuarios | Coste 10K usuarios | Notas |
|-----------|-------------------|-------------------|-------|
| **Groq (MVP)** | $0 | $0 | Límite: ~43K req/día |
| **Gemini Flash** | ~$20 | ~$200 | Tier gratis generoso |
| **Claude Sonnet** | ~$80 | ~$800 | Mejor calidad |
| **GPT-4o-mini** | ~$30 | ~$300 | Balance calidad/precio |
| **Claude Haiku** | ~$15 | ~$150 | Tareas simples |

### Costes de Infraestructura por Fase

| Fase | Supabase | Vercel | Otros | Total |
|------|----------|--------|-------|-------|
| MVP | $0 (Free) | $0 (Free) | $0 | **$0** |
| Validación | $25 (Pro) | $20 (Pro) | $10 (Upstash) | **$55** |
| Producción | $75+ (Pro+) | $40+ (Team) | $30+ | **$145+** |

### Estrategias de Optimización de Costes

#### Durante MVP (Gratis)
1. ✅ Usar Groq Llama 3.1 70B (gratis, rápido)
2. ✅ Embeddings con Supabase gte-small incluido
3. ✅ Caché agresivo con Supabase (evitar re-generaciones)

#### Durante Validación
4. 🔄 Cambiar a Gemini si Groq no escala
5. 🔄 Rate limiting inteligente (3-5 generaciones/usuario/día)
6. 🔄 Prompts optimizados para reducir tokens

#### En Producción
7. 💰 Claude Haiku para tareas simples (80% más barato)
8. 💰 Batch embeddings en off-peak
9. 💰 Caché semántico (respuestas similares reutilizadas)
10. 💰 Tiering: más generaciones para usuarios de pago

### Modelo de Monetización Sugerido

| Plan | Precio | Generaciones IA/mes | ROI estimado |
|------|--------|---------------------|--------------|
| Free | €0 | 3 | Adquisición |
| Pro | €4.99/mes | 20 | +€4.91/usuario |
| Family | €9.99/mes | Ilimitadas | +€9.91/usuario* |

*Asumiendo ~40 generaciones/mes máximo por familia activa.

**Break-even analysis (Producción con Claude):**
- Coste por usuario: ~$0.08/mes
- Plan Pro €4.99: Margen de ~€4.90/usuario
- Con 1000 usuarios Pro: €4,900/mes ingresos vs ~$150 costes = **~97% margen**

---

## Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| **MVP: Groq rate limits** | Media | Medio | Implementar cola de espera; fallback a Mistral gratis |
| **MVP: Groq descontinúa tier gratis** | Baja | Alto | Abstracción permite migrar a Gemini en minutos |
| **Validación: Límites Gemini excedidos** | Media | Bajo | Migrar a plan de pago ($0.075/1M tokens) |
| Proveedor principal no disponible | Baja | Alto | Fallback automático configurado; cola de reintentos |
| Respuestas IA mal formateadas | Media | Medio | Validación estricta + retry con prompt más explícito |
| Costes escalan rápido (producción) | Media | Alto | Rate limiting estricto; caché; monitorización |
| Calidad Llama vs Claude | Media | Medio | Testing A/B; ajuste de prompts por modelo |
| Latencia alta (>5s) | Baja | Medio | Groq es ~500ms; streaming para otros |
| Alucinaciones (IDs inventados) | Media | Alto | Validación post-generación; solo IDs del pool |
| Migración de proveedor rompe algo | Baja | Medio | Tests de integración por proveedor; feature flags |

---

## Métricas de Éxito

### KPIs Primarios

| Métrica | Baseline | Target 3 meses |
|---------|----------|----------------|
| % planes generados con IA | 0% | 70% |
| Tasa de aceptación (sin modificar) | ~40% | >60% |
| NPS de planes generados | N/A | >50 |
| Tiempo promedio de generación | N/A | <8s |

### KPIs Secundarios

| Métrica | Target |
|---------|--------|
| Error rate generación | <2% |
| % usuarios con feedback | >30% |
| Coste por generación | <$0.02 |
| Recetas únicas usadas/semana | >80% del pool |

---

## Siguiente Paso

### Sprint 0: Setup Gratuito (1-2 días)

1. ✅ **Crear cuenta Groq** → [console.groq.com](https://console.groq.com) (gratis, sin tarjeta)
2. ✅ **Habilitar pgvector** en Supabase (ya incluido en plan gratuito)
3. ✅ **Crear abstracción LLMClient** con GroqClient inicial
4. ✅ **Test básico**: Generar un meal plan con prompt hardcodeado

### Sprint 1: MVP Funcional (1 semana)

5. 🔨 **Implementar PromptBuilder** con templates
6. 🔨 **Endpoint `/ai/meal-plans/generate`** usando Groq
7. 🔨 **Validación de respuesta** (IDs existen, JSON válido)
8. 🔨 **UI básica** de generación con loading state

### Validación

9. 📊 **Spike con 10 usuarios beta** (3 días)
10. 📊 **Medir**: Latencia, calidad, rate de errores
11. 📊 **Decidir**: ¿Groq suficiente o migrar a Gemini?

### Escalado

12. 🚀 Si Groq funciona → continuar con Fase 2
13. 🔄 Si necesita mejor calidad → cambiar `LLM_PROVIDER=google`
14. 💰 Si hay tracción → planificar migración a Claude

---

## Apéndices

### A. Ejemplo de Prompt Completo

<details>
<summary>Ver prompt de ejemplo</summary>

```
[SYSTEM]
Eres un nutricionista y chef experto especializado en planificación de comidas para familias españolas...

[USER]
## Contexto del usuario

**Perfil:**
- Tamaño del hogar: 4 personas
- Nivel de cocina: intermediate
- Presupuesto semanal: 120€
- Tiempo máximo de preparación: 45 minutos

**Restricciones dietéticas:**
- Sin gluten

**Preferencias de cocina:**
- Mediterránea
- Española

**Ingredientes a evitar:**
- Cilantro
- Aceitunas

## Contexto temporal
- Semana del: 2025-02-17 al 2025-02-23
- Estación: Invierno

## Pool de recetas disponibles

### Lentejas estofadas con verduras
- ID: 550e8400-e29b-41d4-a716-446655440001
- Tiempo: 15 + 45 min
- Dificultad: easy
- Cocina: Española
- Tags: legumbres, invierno, económico
- Ingredientes principales: lentejas, zanahoria, patata, chorizo

### Merluza al horno con patatas
- ID: 550e8400-e29b-41d4-a716-446655440002
- Tiempo: 20 + 35 min
- Dificultad: medium
- Cocina: Española
- Tags: pescado, horno, sin gluten
- Ingredientes principales: merluza, patata, pimiento

[... más recetas ...]

## Tu tarea
Genera un plan de comidas para la semana indicada con:
- 2 comidas por día: almuerzo, cena
- Nivel de variedad: high
- Ajustado al presupuesto de 120€

Responde SOLO con el JSON estructurado.
```
</details>

### B. Ejemplo de Response IA

<details>
<summary>Ver response de ejemplo</summary>

```json
{
  "mealPlan": {
    "explanation": "He diseñado un plan equilibrado que alterna entre pescado, carne y legumbres. Aprovecho ingredientes como las patatas que aparecen en varias recetas para optimizar tu compra. Los platos más elaborados están el fin de semana cuando hay más tiempo.",
    "days": [
      {
        "date": "2025-02-17",
        "meals": {
          "lunch": {
            "recipeId": "550e8400-e29b-41d4-a716-446655440001",
            "servings": 4,
            "notes": "Puedes hacer doble cantidad y congelar"
          },
          "dinner": {
            "recipeId": "550e8400-e29b-41d4-a716-446655440002",
            "servings": 4
          }
        }
      }
    ]
  },
  "shoppingTips": [
    "Compra las patatas en malla de 3kg, las usarás en 4 recetas esta semana",
    "La merluza está en oferta en Mercadona esta semana"
  ],
  "mealPrepSuggestions": [
    "El domingo, deja las lentejas en remojo para el lunes",
    "Prepara un sofrito base el domingo que te sirve para 3 recetas"
  ]
}
```
</details>

### C. Configuración pgvector

```sql
-- Habilitar extensión (Supabase lo soporta nativamente)
CREATE EXTENSION IF NOT EXISTS vector;

-- Función de búsqueda por similitud
CREATE OR REPLACE FUNCTION search_similar_recipes(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  recipe_id uuid,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    re.recipe_id,
    1 - (re.embedding <=> query_embedding) as similarity
  FROM recipe_embeddings re
  WHERE 1 - (re.embedding <=> query_embedding) > match_threshold
  ORDER BY re.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```
