# Investigación: APIs de Supermercados Españoles para MealMate

**Fecha:** 21 de febrero de 2026  
**Versión:** 1.0  
**Estado:** Investigación completada

---

## Resumen Ejecutivo

### Hallazgos Clave

1. **✅ Mercadona tiene API REST pública** - Endpoints accesibles en `tienda.mercadona.es/api/`
2. **Soysuper es la mejor opción agregadora** - ya integra 9 supermercados (Mercadona, Carrefour, Alcampo, El Corte Inglés, Eroski, Condis, DIA, Caprabo)
3. **Protección anti-bot variable** - Carrefour y El Corte Inglés tienen protección Cloudflare agresiva
4. **Open Food Facts** ofrece una API gratuita con datos nutricionales, pero no precios actualizados
5. **mercapy descartado** - Librería desactualizada (+2 años sin mantenimiento)

### Recomendación Principal

**Arquitectura por fases:**
1. **Fase 1 (MVP):** Integrar API directa de Mercadona → 2-3 semanas
2. **Fase 2:** Expandir con Soysuper scraping para más supermercados → 3-4 semanas  
3. **Fase 3:** Estabilización, monitorización y partnerships

---

## 1. Análisis por Supermercado

### 1.1 Mercadona ⭐ RECOMENDADO PARA MVP

| Aspecto | Detalles |
|---------|----------|
| **API Pública** | ✅ **SÍ - API REST accesible públicamente** |
| **Web Online** | https://tienda.mercadona.es |
| **robots.txt** | ✅ Muy permisivo - `Disallow:` vacío |
| **Protección Anti-bot** | 🟢 Baja - API abierta |

#### 🎯 API REST de Mercadona (Descubierta)

**Endpoints disponibles:**

| Endpoint | Descripción | Ejemplo |
|----------|-------------|---------|
| `/api/categories/` | Listado de todas las categorías | https://tienda.mercadona.es/api/categories/ |
| `/api/categories/{id}/` | Categoría con sus productos | https://tienda.mercadona.es/api/categories/112/ |
| `/api/products/{id}/` | Detalle de un producto | https://tienda.mercadona.es/api/products/34180/ |

**Nota importante:** Requiere código postal válido para acceder. Usar uno de los códigos postales con cobertura (ej: 28001 Madrid, 46001 Valencia, 08001 Barcelona).

**Estructura de respuesta de producto:**
```json
{
  "id": "34180",
  "name": "Galletas digestive",
  "price": 1.25,
  "unit_price": "4.17 €/kg",
  "packaging": "300g",
  "category": {...},
  "photos": [...],
  "details": {...}
}
```

**Ventajas de usar la API directa:**
- ✅ No requiere scraping HTML
- ✅ Respuestas JSON estructuradas
- ✅ Más estable que parsing de HTML
- ✅ Incluye precios, fotos, categorías
- ✅ Sin necesidad de librerías de terceros (mercapy desactualizado desde 2024)

**Referencia:** [Artículo sobre la API de Mercadona](https://medium.com/@ablancodev/trasteando-la-api-del-mercadona-cff067abc002)

---

### 1.2 Carrefour

| Aspecto | Detalles |
|---------|----------|
| **API Oficial** | ❌ No disponible públicamente |
| **Web Online** | https://www.carrefour.es/supermercado |
| **robots.txt** | ⚠️ Restrictivo en filtros y parámetros |
| **Scraping Viable** | ⚠️ Difícil - Cloudflare activo |
| **Protección Anti-bot** | 🔴 Alta - Bloqueo activo de bots |

**Observaciones:**
- El robots.txt bloquea múltiples user-agents de bots
- Cloudflare bloquea acceso programático directo
- Requeriría navegador headless con evasión anti-bot sofisticada
- El proyecto `Supermarket-Price-Scraper` de joseluam97 incluye soporte para Carrefour

---

### 1.3 DIA

| Aspecto | Detalles |
|---------|----------|
| **API Oficial** | ❌ No disponible |
| **Web Online** | https://www.dia.es |
| **robots.txt** | ⚠️ Moderadamente restrictivo |
| **Scraping Viable** | ✅ Posible con precauciones |
| **Protección Anti-bot** | ⚠️ Moderada |

**Observaciones:**
- Bloquea Amazonbot y varios crawlers
- Permite acceso general (`User-agent: *`)
- Usa Algolia para búsqueda (potencial API interna)
- Incluido en Soysuper

---

### 1.4 Alcampo

| Aspecto | Detalles |
|---------|----------|
| **API Oficial** | ❌ No disponible |
| **Web Online** | https://www.compraonline.alcampo.es |
| **robots.txt** | ✅ Permisivo - Solo bloquea bots específicos |
| **Scraping Viable** | ✅ Viable |
| **Protección Anti-bot** | 🟢 Baja |

**Observaciones:**
- Estructura web clara y navegable
- Sitemap disponible para indexación
- Incluido en Soysuper

---

### 1.5 Eroski

| Aspecto | Detalles |
|---------|----------|
| **API Oficial** | ❌ No disponible |
| **Web Online** | https://supermercado.eroski.es |
| **robots.txt** | ✅ Bastante permisivo |
| **Scraping Viable** | ✅ Viable |
| **Protección Anti-bot** | 🟢 Baja |

**Observaciones:**
- WordPress como CMS (estructura conocida)
- Marketplace integrado
- Incluido en Soysuper

---

### 1.6 El Corte Inglés (Supermercado)

| Aspecto | Detalles |
|---------|----------|
| **API Oficial** | ❌ No disponible |
| **Web Online** | https://www.elcorteingles.es/supermercado |
| **robots.txt** | 🔴 Muy restrictivo - Bloquea ClaudeBot |
| **Scraping Viable** | ⚠️ Difícil y posiblemente conflictivo |
| **Protección Anti-bot** | 🔴 Alta |

**Observaciones:**
- Bloquea explícitamente: ClaudeBot, CCBot, Amazonbot, Bytespider
- Múltiples filtros bloqueados
- Cloudflare y protección avanzada
- Incluido en Soysuper (mejor usar vía Soysuper)

---

### 1.7 Lidl

| Aspecto | Detalles |
|---------|----------|
| **API Oficial** | ❌ No disponible |
| **Web Online** | https://www.lidl.es (catálogo, no compra online completa) |
| **robots.txt** | ⚠️ Moderadamente restrictivo |
| **Scraping Viable** | ⚠️ Parcial - Sin tienda online completa |
| **Protección Anti-bot** | ⚠️ Moderada |

**Observaciones:**
- Lidl no tiene compra online completa en España (solo algunas categorías)
- Sitemaps de productos disponibles
- No incluido en Soysuper

---

### 1.8 Aldi

| Aspecto | Detalles |
|---------|----------|
| **API Oficial** | ❌ No disponible |
| **Web Online** | https://www.aldi.es (solo catálogo) |
| **robots.txt** | ✅ Bastante permisivo |
| **Scraping Viable** | ⚠️ Limitado - Solo catálogo |
| **Protección Anti-bot** | 🟢 Baja |

**Observaciones:**
- Aldi no tiene compra online en España
- Solo catálogo de productos/ofertas
- Sitemap disponible

---

### 1.9 Consum

| Aspecto | Detalles |
|---------|----------|
| **API Oficial** | ❌ No disponible |
| **Web Online** | https://tienda.consum.es |
| **robots.txt** | ⚠️ Drupal estándar |
| **Scraping Viable** | ⚠️ Estructura compleja |
| **Protección Anti-bot** | ⚠️ Moderada |

**Observaciones:**
- Drupal CMS
- Regional (Comunidad Valenciana principalmente)
- No incluido en Soysuper

---

### 1.10 BonPreu/Esclat

| Aspecto | Detalles |
|---------|----------|
| **API Oficial** | ❌ No disponible |
| **Web Online** | https://www.bonpreuesclat.cat |
| **robots.txt** | ✅ Permisivo |
| **Scraping Viable** | ✅ Posible |
| **Protección Anti-bot** | 🟢 Baja |

**Observaciones:**
- Regional (Cataluña)
- Sitemap disponible
- No incluido en Soysuper

---

## 2. Alternativas Agregadoras

### 2.1 Soysuper ⭐ RECOMENDADO

| Aspecto | Detalles |
|---------|----------|
| **URL** | https://soysuper.com |
| **Tipo** | Comparador/Agregador |
| **Supermercados** | Mercadona, Carrefour, Alcampo, El Corte Inglés, Hipercor, Eroski, Condis, DIA, Caprabo |
| **API Pública** | ❌ No documentada |
| **Integración** | Redirige al checkout del supermercado original |

**Ventajas:**
- Precios actualizados de múltiples supermercados
- Comparación de cestas de la compra
- Cobertura geográfica nacional (por código postal)
- Interfaz unificada

**Desventajas:**
- Sin API pública oficial
- Sería necesario scraping o partnership
- Los precios mostrados sin login son "precios medios"

**Estrategia posible:**
1. Crear cuenta de usuario
2. Usar sesión autenticada para obtener precios exactos
3. Scraping de la plataforma con respeto a sus ToS

---

### 2.2 Open Food Facts

| Aspecto | Detalles |
|---------|----------|
| **URL** | https://es.openfoodfacts.org |
| **API** | ✅ Gratuita y abierta |
| **Productos España** | ~363,000+ |
| **Precios** | ❌ No incluye precios actualizados |

**API Endpoints:**
```
https://world.openfoodfacts.org/api/v2/product/{barcode}
https://world.openfoodfacts.org/api/v2/search?countries_tags=spain
```

**Útil para:**
- Información nutricional
- Categorización de productos
- Códigos de barras
- Imágenes de productos

**No útil para:**
- Precios actualizados
- Disponibilidad en tiendas

---

### 2.3 Otros Comparadores (Históricos/Limitados)

| Plataforma | Estado |
|------------|--------|
| Carritus | ⚠️ Funcionalidad reducida |
| Tiendeo | Solo folletos/ofertas, no precios unitarios |
| Radarprice | ⚠️ Cobertura limitada |

---

## 3. Proyectos Open Source Relevantes

### 3.1 Scrapers Multi-Supermercado

| Proyecto | Supermercados | Última actualización |
|----------|---------------|----------------------|
| [joseluam97/Supermarket-Price-Scraper](https://github.com/joseluam97/Supermarket-Price-Scraper) | Mercadona, Carrefour, DIA | Ago 2024 |

**Características:**
- Exporta a Excel/CSV
- Requiere configuración de cookies
- Python con Selenium

### 3.2 Scrapers Específicos de Mercadona

| Proyecto | Características |
|----------|-----------------|
| [vgvr0/supermarket-mercadona-scraper](https://github.com/vgvr0/supermarket-mercadona-scraper) | SeleniumBase, anti-detección, CSV output |
| [jtayped/mercapy](https://github.com/jtayped/mercapy) | Librería pip, API limpia, búsqueda y productos |

---

## 4. Tabla Comparativa de Opciones

| Opción | Facilidad (1-5) | Cobertura | Actualización | Legalidad | Coste |
|--------|-----------------|-----------|---------------|-----------|-------|
| **API Mercadona (directa)** ⭐ | 5 | Media (1 supermercado) | Tiempo real | ✅ API pública | Gratis |
| **Soysuper (scraping)** | 3 | Alta (9 supermercados) | Diaria | ⚠️ Gris | Gratis |
| **Scraper propio** | 2 | Variable | Configurable | ⚠️ Gris | Desarrollo |
| **Open Food Facts** | 5 | Alta | Variable | ✅ Legal | Gratis |
| **Partnership oficial** | 1 | Alta | Tiempo real | ✅ Legal | Alto/Negociable |

**Nota:** mercapy descartado por estar desactualizado (+2 años sin mantenimiento). Usar API directa de Mercadona es más fiable.

---

## 5. Recomendación de Arquitectura

### Arquitectura Híbrida Propuesta

```
┌─────────────────────────────────────────────────────────────┐
│                        MealMate Backend                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │  Price Service   │  │  Product Service │                 │
│  └────────┬─────────┘  └────────┬─────────┘                 │
│           │                     │                            │
│           ▼                     ▼                            │
│  ┌──────────────────────────────────────────┐               │
│  │           Price Aggregator               │               │
│  │  - Cache Redis (TTL: 24h)                │               │
│  │  - Rate limiting                         │               │
│  │  - Fallback to estimates                 │               │
│  └──────────────────────────────────────────┘               │
│                         │                                    │
│           ┌─────────────┼─────────────┐                     │
│           ▼             ▼             ▼                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │   Mercadona  │ │   Soysuper   │ │ Open Food    │        │
│  │   Adapter    │ │   Adapter    │ │ Facts API    │        │
│  │  (mercapy)   │ │  (scraping)  │ │              │        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Componentes Clave

1. **Price Aggregator Service**
   - Centraliza todas las fuentes de precios
   - Cache con Redis (TTL 24h)
   - Fallback a precios estimados si falla scraping

2. **Adaptadores por Fuente**
   - Mercadona: mercapy o scraper propio
   - Otros: Soysuper scraping
   - Datos nutricionales: Open Food Facts

3. **Background Workers**
   - Actualización de precios nocturna
   - Detección de cambios de precio
   - Alertas de disponibilidad

---

## 6. Plan de Implementación por Fases

### Fase 1: MVP con API de Mercadona (2-3 semanas)

**Objetivo:** Integrar precios reales de Mercadona usando su API REST pública

**Arquitectura:**
```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   MealMate UI   │────▶│  Mercadona       │────▶│  Mercadona API  │
│                 │     │  Service (Node)   │     │  tienda.mercd.. │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │  Cache (Redis)   │
                        │  TTL: 24h        │
                        └──────────────────┘
```

**Tareas:**

| # | Tarea | Tiempo | Prioridad |
|---|-------|--------|-----------|
| 1 | Crear cliente HTTP para API Mercadona | 2 días | Alta |
| 2 | Implementar endpoints: categorías, productos, búsqueda | 2 días | Alta |
| 3 | Cache con Redis (o en memoria para MVP) | 1 día | Alta |
| 4 | Sincronización de catálogo (job nocturno) | 2 días | Media |
| 5 | Mapeo ingredientes MealMate → productos Mercadona | 3 días | Alta |
| 6 | API interna para consultar precios desde UI | 1 día | Alta |
| 7 | Mostrar precios reales en lista de compra | 2 días | Alta |
| 8 | Fallback a precios estimados si falla | 1 día | Media |
| 9 | Tests e2e y monitorización | 2 días | Media |

**Endpoints a implementar en MealMate:**
```
GET /api/v1/supermarkets/mercadona/categories
GET /api/v1/supermarkets/mercadona/products?category={id}
GET /api/v1/supermarkets/mercadona/products/{id}
GET /api/v1/supermarkets/mercadona/search?q={query}
GET /api/v1/prices/ingredient/{ingredientId}  → precio real o estimado
```

**Consideraciones técnicas:**
- Usar código postal válido en headers (ej: `x-postal-code: 46001`)
- Rate limiting: máximo 1 req/seg para no sobrecargar
- Cache categorías por 7 días, productos por 24h
- Job nocturno para actualizar precios

**Riesgos y mitigaciones:**
| Riesgo | Mitigación |
|--------|------------|
| Mercadona cambia API | Monitorizar estructura, tests diarios |
| Bloqueo por rate limit | Implementar backoff exponencial |
| Productos no encontrados | Fallback a precios estimados |

### Fase 2: Expansión a Soysuper (3-4 semanas)

**Objetivo:** Agregar precios de múltiples supermercados via Soysuper

**Tareas:**
1. Analizar estructura de Soysuper con cuenta autenticada
2. Desarrollar scraper con Playwright/Puppeteer
3. Implementar rotación de user-agents y proxies
4. Sistema de comparación de precios entre supermercados
5. UI para que usuario elija supermercado preferido

**Riesgos:**
- ToS de Soysuper
- Cambios frecuentes en la web

### Fase 3: Estabilización y Escalado (2-3 semanas)

**Objetivo:** Robustez y monitorización

**Tareas:**
1. Sistema de alertas cuando falla scraping
2. Dashboard de estado de fuentes de precios
3. Métricas de cobertura (% productos con precio real vs estimado)
4. Documentación y runbooks

### Fase 4: Explorar Partnerships (Ongoing)

**Objetivo:** Buscar integraciones oficiales

**Tareas:**
1. Contactar departamentos de negocio de supermercados
2. Explorar programa de afiliados de Carrefour
3. Evaluar si hay APIs B2B disponibles

---

## 7. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Bloqueo de scraping | Alta | Alto | Rotación de IPs, rate limiting agresivo, fallback a estimados |
| Cambios en estructura web | Media | Medio | Tests de regresión diarios, alertas automáticas |
| Demanda legal | Baja | Alto | No comercializar datos, respetar robots.txt, considerar partnership |
| Datos desactualizados | Media | Medio | Cache con TTL corto, mostrar fecha de última actualización |
| Mercadona cierra API interna | Media | Alto | Diversificar fuentes (Soysuper como backup) |

---

## 8. Consideraciones Legales

### Web Scraping en España

- **Directiva de Bases de Datos de la UE:** Protege bases de datos con inversión sustancial
- **RGPD:** No aplica a datos de productos/precios (no son datos personales)
- **ToS de cada sitio:** Variable, generalmente prohíben scraping comercial
- **Caso LinkedIn vs hiQ:** Precedente favorable para scraping de datos públicos

### Recomendaciones

1. **Respetar robots.txt** siempre
2. **Rate limiting agresivo** (máximo 1 request/segundo)
3. **No saturar servidores** (horarios nocturnos preferentes)
4. **No redistribuir datos crudos** (solo usar internamente)
5. **Atribuir fuente** cuando se muestren precios

---

## 9. Próximos Pasos

1. [ ] **Inmediato:** Probar API de Mercadona manualmente (curl/Postman)
2. [ ] **Esta semana:** Crear cliente TypeScript para API Mercadona
3. [ ] **Semana 2:** Implementar servicio de precios con cache
4. [ ] **Semana 3:** Mapear ingredientes MealMate → productos Mercadona
5. [ ] **Semana 4:** Integrar precios reales en UI de lista de compra
6. [ ] **Mes 2:** Expandir a Soysuper para más supermercados

### Comandos para probar la API de Mercadona:

```bash
# Listar categorías
curl -s "https://tienda.mercadona.es/api/categories/" | jq

# Ver categoría específica con productos
curl -s "https://tienda.mercadona.es/api/categories/112/" | jq

# Ver producto específico
curl -s "https://tienda.mercadona.es/api/products/34180/" | jq
```

---

## Anexos

### A. URLs de Compra Online por Supermercado

| Supermercado | URL Tienda Online |
|--------------|-------------------|
| Mercadona | https://tienda.mercadona.es |
| Carrefour | https://www.carrefour.es/supermercado |
| DIA | https://www.dia.es |
| Alcampo | https://www.compraonline.alcampo.es |
| Eroski | https://supermercado.eroski.es |
| El Corte Inglés | https://www.elcorteingles.es/supermercado |
| Consum | https://tienda.consum.es |
| BonPreu | https://www.bonpreuesclat.cat |
| Lidl | https://www.lidl.es (solo catálogo) |
| Aldi | https://www.aldi.es (solo catálogo) |

### B. robots.txt Resumen

| Supermercado | Permisividad | Notas |
|--------------|--------------|-------|
| Mercadona | ✅ Muy permisivo | `Disallow:` vacío |
| Carrefour | ⚠️ Restrictivo | Muchos filtros bloqueados |
| DIA | ⚠️ Moderado | Bloquea algunos bots |
| Alcampo | ✅ Permisivo | Solo bots específicos |
| Eroski | ✅ Permisivo | WordPress estándar |
| El Corte Inglés | 🔴 Muy restrictivo | Bloquea ClaudeBot, CCBot |
| Lidl | ⚠️ Moderado | Bloquea búsqueda |
| Aldi | ✅ Permisivo | Estándar |
| Consum | ⚠️ Moderado | Drupal estándar |
| BonPreu | ✅ Permisivo | Básico |

---

*Documento generado el 21/02/2026 para el proyecto MealMate*
