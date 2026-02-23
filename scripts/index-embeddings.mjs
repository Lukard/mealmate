import { pipeline } from '@xenova/transformers';
import pg from 'pg';
const { Client } = pg;

const DB_URL = 'postgresql://postgres.buxejnacvfagshwxagrf:ELIUIfVXrXubJFui@aws-1-eu-west-3.pooler.supabase.com:5432/postgres';
const BATCH_SIZE = 50;

console.log('Loading model (first time downloads ~80MB)...');
const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
console.log('Model loaded!');

const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
console.log('Connected to DB');

const { rows: products } = await client.query(
  'SELECT id, name, category FROM supermarket_products WHERE embedding IS NULL ORDER BY id'
);
console.log(`Products to index: ${products.length}`);

let indexed = 0;
let errors = 0;

for (let i = 0; i < products.length; i += BATCH_SIZE) {
  const batch = products.slice(i, i + BATCH_SIZE);
  
  for (const product of batch) {
    try {
      const text = `${product.category || ''}: ${product.name}`.trim();
      const output = await extractor(text, { pooling: 'mean', normalize: true });
      const embedding = Array.from(output.data);
      
      if (embedding.length !== 384) {
        console.error(`Bad dim ${embedding.length} for ${product.name}`);
        errors++;
        continue;
      }
      
      await client.query(
        'UPDATE supermarket_products SET embedding = $1 WHERE id = $2',
        [`[${embedding.join(',')}]`, product.id]
      );
      indexed++;
    } catch (e) {
      console.error(`Failed ${product.name}: ${e.message}`);
      errors++;
    }
  }
  
  console.log(`Progress: ${indexed + errors}/${products.length} (${indexed} ok, ${errors} err)`);
}

const { rows: [counts] } = await client.query(
  'SELECT count(*) as total, count(embedding) as with_emb FROM supermarket_products'
);
console.log(`\nDone! ${counts.with_emb}/${counts.total} products have embeddings`);
await client.end();
