/**
 * Run Supabase migration manually
 * Usage: npx tsx scripts/run-migration.ts
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

async function runMigration() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    console.log('Make sure to run: source ~/.zprofile');
    process.exit(1);
  }

  console.log('Connecting to Supabase:', url);
  
  // For raw SQL execution, we need to use the REST API directly with the pg_catalog
  // or use the Supabase Dashboard. Let's try a different approach - create tables via the client.

  const supabase = createClient(url, key, {
    auth: { persistSession: false }
  });

  // Test connection
  const { data, error } = await supabase.from('supermarket_products').select('count').limit(1);
  
  if (error && error.code === '42P01') {
    // Table doesn't exist - we need to create it via Dashboard
    console.log('\n⚠️  Tables do not exist yet.');
    console.log('\nPlease run this SQL in Supabase Dashboard → SQL Editor:');
    console.log('─'.repeat(60));
    
    const sql = readFileSync(join(__dirname, '../supabase/migrations/003_supermarket_products.sql'), 'utf8');
    console.log(sql);
    console.log('─'.repeat(60));
    console.log('\nDashboard URL: https://supabase.com/dashboard/project/buxejnacvfagshwxagrf/sql');
  } else if (error) {
    console.error('Error:', error.message);
  } else {
    console.log('✅ Tables already exist!');
    console.log('Ready to run sync-mercadona.ts');
  }
}

runMigration().catch(console.error);
