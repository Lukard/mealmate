/**
 * Run init-db.sql to create all database tables
 */
import postgres from 'postgres';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://localhost:5432/meal_automation';

async function runInitSql(): Promise<void> {
  console.log('Running database initialization SQL...');
  console.log(`Database URL: ${DATABASE_URL.replace(/:[^:@]+@/, ':****@')}`);

  const sqlPath = path.join(__dirname, 'init-db.sql');
  console.log(`SQL file path: ${sqlPath}`);

  if (!fs.existsSync(sqlPath)) {
    console.error('ERROR: init-db.sql not found!');
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf-8');
  console.log(`SQL file loaded (${sql.length} characters)`);

  const queryClient = postgres(DATABASE_URL, { max: 1 });

  try {
    // Test connection first
    await queryClient`SELECT 1 as test`;
    console.log('Database connection successful');

    // Run the SQL file
    console.log('Executing SQL...');
    await queryClient.unsafe(sql);
    console.log('Database tables created successfully!');

    // Verify tables were created
    const tables = await queryClient`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    console.log(`Tables created: ${tables.length}`);
    tables.forEach(t => console.log(`  - ${t.table_name}`));
  } catch (error) {
    console.error('SQL execution failed:', error);
    process.exit(1);
  } finally {
    await queryClient.end();
  }
}

runInitSql();
