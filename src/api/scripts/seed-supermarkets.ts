/**
 * Seed Script - Spanish Supermarkets
 * Seeds the database with Spanish supermarket chains
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { supermarkets, type ScrapingConfig } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://localhost:5432/meal_automation';

interface SupermarketSeed {
  name: string;
  slug: string;
  domain: string;
  logoUrl?: string;
  color: string;
  scrapingEnabled: boolean;
  scrapingConfig: ScrapingConfig;
}

const spanishSupermarkets: SupermarketSeed[] = [
  {
    name: 'DIA',
    slug: 'dia',
    domain: 'www.dia.es',
    color: '#E30613',
    scrapingEnabled: true,
    scrapingConfig: {
      baseUrl: 'https://www.dia.es',
      searchEndpoint: '/api/v1/search',
      rateLimit: 100,
      selectors: {
        productList: '.product-list',
        productName: '.product-name',
        productPrice: '.product-price',
        productImage: '.product-image img',
        productUnit: '.product-unit-price',
      },
    },
  },
  {
    name: 'Mercadona',
    slug: 'mercadona',
    domain: 'tienda.mercadona.es',
    color: '#5EB82D',
    scrapingEnabled: true,
    scrapingConfig: {
      baseUrl: 'https://tienda.mercadona.es',
      searchEndpoint: '/api/catalog/categories',
      rateLimit: 50,
      selectors: {
        productList: '.product-cell',
        productName: '.product-cell__description-name',
        productPrice: '.product-cell__price',
        productImage: '.product-cell__image img',
        productUnit: '.product-cell__unit-price',
      },
      headers: {
        'Accept': 'application/json',
      },
    },
  },
  {
    name: 'Carrefour',
    slug: 'carrefour',
    domain: 'www.carrefour.es',
    color: '#004E9A',
    scrapingEnabled: true,
    scrapingConfig: {
      baseUrl: 'https://www.carrefour.es',
      searchEndpoint: '/supermercado/buscar',
      rateLimit: 100,
      selectors: {
        productList: '.product-card',
        productName: '.product-card__title',
        productPrice: '.product-card__price',
        productImage: '.product-card__image img',
        productUnit: '.product-card__price-per-unit',
      },
    },
  },
  {
    name: 'Lidl',
    slug: 'lidl',
    domain: 'www.lidl.es',
    color: '#0050AA',
    scrapingEnabled: true,
    scrapingConfig: {
      baseUrl: 'https://www.lidl.es',
      searchEndpoint: '/q/search',
      rateLimit: 100,
      selectors: {
        productList: '.product-grid-box',
        productName: '.product-grid-box__title',
        productPrice: '.pricebox__price',
        productImage: '.product-grid-box__image img',
        productUnit: '.pricebox__basic-quantity',
      },
    },
  },
  {
    name: 'Alcampo',
    slug: 'alcampo',
    domain: 'www.alcampo.es',
    color: '#E2001A',
    scrapingEnabled: true,
    scrapingConfig: {
      baseUrl: 'https://www.alcampo.es',
      searchEndpoint: '/compra-online/buscar',
      rateLimit: 100,
      selectors: {
        productList: '.product-item',
        productName: '.product-item__name',
        productPrice: '.product-item__price',
        productImage: '.product-item__image img',
        productUnit: '.product-item__unit-price',
      },
    },
  },
  {
    name: 'Eroski',
    slug: 'eroski',
    domain: 'www.eroski.es',
    color: '#E30613',
    scrapingEnabled: true,
    scrapingConfig: {
      baseUrl: 'https://www.eroski.es',
      searchEndpoint: '/supermercado/search',
      rateLimit: 100,
      selectors: {
        productList: '.product-card',
        productName: '.product-card__name',
        productPrice: '.product-card__price',
        productImage: '.product-card__image img',
        productUnit: '.product-card__unit-price',
      },
    },
  },
  {
    name: 'Consum',
    slug: 'consum',
    domain: 'tienda.consum.es',
    color: '#009639',
    scrapingEnabled: true,
    scrapingConfig: {
      baseUrl: 'https://tienda.consum.es',
      searchEndpoint: '/api/rest/V1.0/catalog/search',
      rateLimit: 100,
      selectors: {
        productList: '.product-tile',
        productName: '.product-tile__name',
        productPrice: '.product-tile__price',
        productImage: '.product-tile__image img',
        productUnit: '.product-tile__unit-price',
      },
    },
  },
  {
    name: 'El Corte Ingles',
    slug: 'el-corte-ingles',
    domain: 'www.elcorteingles.es',
    color: '#006633',
    scrapingEnabled: true,
    scrapingConfig: {
      baseUrl: 'https://www.elcorteingles.es',
      searchEndpoint: '/supermercado/buscar',
      rateLimit: 50,
      selectors: {
        productList: '.product-preview',
        productName: '.product-preview__name',
        productPrice: '.product-preview__price',
        productImage: '.product-preview__image img',
        productUnit: '.product-preview__unit-price',
      },
    },
  },
];

async function seedSupermarkets(): Promise<void> {
  console.log('Starting supermarket seeding...');
  console.log(`Database URL: ${DATABASE_URL.replace(/:[^:@]+@/, ':****@')}`);

  const queryClient = postgres(DATABASE_URL, { max: 1 });
  const db = drizzle(queryClient);

  try {
    console.log(`Seeding ${spanishSupermarkets.length} Spanish supermarkets...`);

    for (const supermarket of spanishSupermarkets) {
      // Check if supermarket already exists
      const existing = await db
        .select()
        .from(supermarkets)
        .where(eq(supermarkets.slug, supermarket.slug))
        .limit(1);

      if (existing.length > 0) {
        console.log(`  - ${supermarket.name}: Already exists, skipping`);
        continue;
      }

      // Insert supermarket
      await db.insert(supermarkets).values(supermarket);
      console.log(`  - ${supermarket.name}: Inserted successfully`);
    }

    console.log('Supermarket seeding completed!');
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    await queryClient.end();
  }
}

seedSupermarkets();
