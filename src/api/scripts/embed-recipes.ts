#!/usr/bin/env tsx
/**
 * Embed Recipes Script
 * Generates embeddings for all recipes in the database
 */

import { getEmbeddingsService } from '../src/services/ai/index.js';

async function main() {
  console.log('🚀 Starting recipe embedding generation...\n');

  const embeddingsService = getEmbeddingsService();

  // Get current stats
  const statsBefore = await embeddingsService.getStats();
  console.log(`📊 Before: ${statsBefore.embeddedRecipes}/${statsBefore.totalRecipes} recipes embedded`);
  console.log(`   Provider: ${statsBefore.provider}, Model: ${statsBefore.model}\n`);

  // Check for --force flag
  const forceAll = process.argv.includes('--force');
  if (forceAll) {
    console.log('⚠️  Force mode: regenerating all embeddings\n');
  }

  // Run embedding
  const result = await embeddingsService.embedAllRecipes({ forceAll });

  // Get final stats
  const statsAfter = await embeddingsService.getStats();

  console.log('\n📊 Results:');
  console.log(`   - Processed: ${result.processed}`);
  console.log(`   - Skipped (already current): ${result.skipped}`);
  console.log(`   - Errors: ${result.errors}`);
  console.log(`\n✅ Total embedded: ${statsAfter.embeddedRecipes}/${statsAfter.totalRecipes} recipes`);

  if (result.errors > 0) {
    console.log('\n⚠️  Some recipes failed. Check logs above for details.');
    process.exit(1);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
