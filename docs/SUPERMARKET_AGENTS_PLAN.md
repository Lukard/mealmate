# Plan de Agentes: Integración de Supermercados

**Fecha:** 21 de febrero de 2026  
**Estado:** Aprobado ✅

---

## Agentes Fase 1

### Agente 1: `architect`
**Objetivo:** Crear la arquitectura base extensible

**Tareas:**
- [ ] Crear estructura de carpetas `src/services/supermarkets/`
- [ ] Definir interfaces TypeScript (`types.ts`)
- [ ] Implementar `SupermarketFactory`
- [ ] Crear clase base `BaseAdapter`
- [ ] Tests unitarios de la arquitectura

**Output:** Código base listo para implementar adapters  
**Tiempo estimado:** 2 días  
**Dependencias:** Ninguna

---

### Agente 2: `mercadona-adapter`
**Objetivo:** Implementar el adapter de Mercadona

**Tareas:**
- [ ] Cliente HTTP con rate limiting
- [ ] Implementar métodos: `searchProducts`, `getProduct`, `getCategories`, `getProductsByCategory`
- [ ] Normalizar respuestas de Mercadona → `NormalizedProduct`
- [ ] Manejo de errores y reintentos
- [ ] Tests del adapter

**Tiempo estimado:** 2 días  
**Dependencias:** Agente 1

---

### Agente 3: `cache-service`
**Objetivo:** Implementar capa de cache

**Tareas:**
- [ ] Servicio de cache (Redis o memoria para MVP)
- [ ] TTL configurable por tipo (productos 24h, categorías 7d)
- [ ] Invalidación de cache
- [ ] Wrapper para adapters con cache automático

**Tiempo estimado:** 1 día  
**Dependencias:** Agente 1

---

### Agente 4: `ingredient-mapper`
**Objetivo:** Mapear ingredientes de recetas → productos de supermercado

**Tareas:**
- [ ] Servicio de búsqueda fuzzy por nombre
- [ ] Tabla de mapeos conocidos (ingrediente → producto ID)
- [ ] Algoritmo de matching (nombre, categoría, cantidad)
- [ ] Cache de mapeos exitosos
- [ ] API endpoint para obtener precio de ingrediente

**Tiempo estimado:** 3 días  
**Dependencias:** Agentes 2 y 3

---

### Agente 5: `sync-worker`
**Objetivo:** Job de sincronización nocturna

**Tareas:**
- [ ] Cron job para actualizar catálogo
- [ ] Sincronizar categorías y productos populares
- [ ] Detectar cambios de precio
- [ ] Logging y métricas

**Tiempo estimado:** 2 días  
**Dependencias:** Agentes 2 y 3

---

### Agente 6: `api-endpoints`
**Objetivo:** Exponer API interna para el frontend

**Tareas:**
- [ ] `GET /api/v1/supermarkets/{id}/categories`
- [ ] `GET /api/v1/supermarkets/{id}/products`
- [ ] `GET /api/v1/supermarkets/{id}/search`
- [ ] `GET /api/v1/prices/ingredient/{id}`
- [ ] Documentación OpenAPI

**Tiempo estimado:** 1 día  
**Dependencias:** Agentes 2, 3 y 4

---

### Agente 7: `ui-integration`
**Objetivo:** Mostrar precios reales en la UI

**Tareas:**
- [ ] Modificar componente de lista de compra
- [ ] Mostrar precio real vs estimado
- [ ] Indicador de supermercado
- [ ] Fallback visual si no hay precio
- [ ] Loading states

**Tiempo estimado:** 2 días  
**Dependencias:** Agente 6

---

### Agente 8: `testing-qa`
**Objetivo:** Tests e2e y validación

**Tareas:**
- [ ] Tests e2e del flujo completo
- [ ] Validar precios contra web real
- [ ] Tests de fallback
- [ ] Documentación de uso

**Tiempo estimado:** 2 días  
**Dependencias:** Todos los agentes anteriores

---

## Diagrama de Dependencias

```
[1. architect]
      │
      ├──────────┬──────────┐
      ▼          ▼          ▼
[2. mercadona] [3. cache]  
      │          │
      └────┬─────┘
           │
      ┌────┴────┬────────────┐
      ▼         ▼            ▼
[4. mapper] [5. sync]   
      │         
      └────┬────┘
           ▼
    [6. api-endpoints]
           │
           ▼
    [7. ui-integration]
           │
           ▼
     [8. testing-qa]
```

---

## Orden de Ejecución

| Orden | Agentes (pueden ser paralelos) | Tiempo |
|-------|-------------------------------|--------|
| 1 | `architect` | 2 días |
| 2 | `mercadona-adapter` + `cache-service` | 2 días |
| 3 | `ingredient-mapper` + `sync-worker` | 3 días |
| 4 | `api-endpoints` | 1 día |
| 5 | `ui-integration` | 2 días |
| 6 | `testing-qa` | 2 días |

**Total estimado: ~12 días (2-3 semanas con buffer)**

---

## Progreso

| Agente | Estado | Fecha inicio | Fecha fin |
|--------|--------|--------------|-----------|
| architect | ✅ Completado | 2026-02-21 | 2026-02-21 |
| mercadona-adapter | ✅ Completado | 2026-02-21 | 2026-02-21 |
| cache-service | ✅ Completado | 2026-02-21 | 2026-02-21 |
| ingredient-mapper | ⏳ Pendiente | - | - |
| sync-worker | ⏳ Pendiente | - | - |
| api-endpoints | ⏳ Pendiente | - | - |
| ui-integration | ⏳ Pendiente | - | - |
| testing-qa | ⏳ Pendiente | - | - |

---

*Plan aprobado el 21/02/2026*
