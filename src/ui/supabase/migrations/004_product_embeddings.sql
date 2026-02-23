-- Migration: Product Embeddings for RAG
-- Adds vector search capability to supermarket_products

-- Enable pgvector extension (idempotent)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to existing products table
ALTER TABLE supermarket_products 
ADD COLUMN IF NOT EXISTS embedding vector(384);

-- Add embedding metadata columns
ALTER TABLE supermarket_products 
ADD COLUMN IF NOT EXISTS embedding_model TEXT,
ADD COLUMN IF NOT EXISTS embedded_at TIMESTAMPTZ;

-- Create HNSW index for fast approximate nearest neighbor search
-- HNSW is faster for queries, slightly slower to build than IVFFlat
-- ef_construction=128: higher = better recall, slower build
-- m=16: connections per layer, good balance for 384 dimensions
CREATE INDEX IF NOT EXISTS idx_products_embedding 
ON supermarket_products 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 128);

-- Alternative: IVFFlat index (comment out HNSW above if using this)
-- CREATE INDEX IF NOT EXISTS idx_products_embedding_ivfflat
-- ON supermarket_products 
-- USING ivfflat (embedding vector_cosine_ops)
-- WITH (lists = 100);

-- Partial index for only embedded products (optimization)
CREATE INDEX IF NOT EXISTS idx_products_has_embedding 
ON supermarket_products (id) 
WHERE embedding IS NOT NULL;

-- ============================================
-- Semantic Search Function
-- ============================================

-- Function: Search products by semantic similarity
CREATE OR REPLACE FUNCTION search_products_semantic(
  query_embedding vector(384),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 10,
  filter_supermarket text DEFAULT NULL,
  filter_category text DEFAULT NULL,
  filter_available boolean DEFAULT true
)
RETURNS TABLE (
  id uuid,
  supermarket_id text,
  external_id text,
  name text,
  brand text,
  price decimal,
  price_per_unit decimal,
  unit text,
  size decimal,
  size_format text,
  category text,
  subcategory text,
  image_url text,
  available boolean,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sp.id,
    sp.supermarket_id,
    sp.external_id,
    sp.name,
    sp.brand,
    sp.price,
    sp.price_per_unit,
    sp.unit,
    sp.size,
    sp.size_format,
    sp.category,
    sp.subcategory,
    sp.image_url,
    sp.available,
    1 - (sp.embedding <=> query_embedding) AS similarity
  FROM supermarket_products sp
  WHERE 
    sp.embedding IS NOT NULL
    AND (filter_supermarket IS NULL OR sp.supermarket_id = filter_supermarket)
    AND (filter_category IS NULL OR sp.category = filter_category)
    AND (NOT filter_available OR sp.available = true)
    AND 1 - (sp.embedding <=> query_embedding) > match_threshold
  ORDER BY sp.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================
-- Batch Search Function (for multiple ingredients)
-- ============================================

-- Type for batch search input
CREATE TYPE IF NOT EXISTS ingredient_search_input AS (
  ingredient_name text,
  embedding vector(384)
);

-- Function: Search products for multiple ingredients at once
CREATE OR REPLACE FUNCTION search_products_batch(
  ingredients jsonb, -- Array of {name: string, embedding: float[]}
  match_threshold float DEFAULT 0.5,
  matches_per_ingredient int DEFAULT 3,
  filter_supermarket text DEFAULT NULL
)
RETURNS TABLE (
  ingredient_name text,
  product_id uuid,
  product_name text,
  brand text,
  price decimal,
  price_per_unit decimal,
  unit text,
  size_format text,
  category text,
  image_url text,
  similarity float
)
LANGUAGE plpgsql
AS $$
DECLARE
  ingredient_record jsonb;
  ingredient_embedding vector(384);
BEGIN
  -- Process each ingredient
  FOR ingredient_record IN SELECT * FROM jsonb_array_elements(ingredients)
  LOOP
    -- Extract embedding from JSON array to vector
    ingredient_embedding := (
      SELECT array_agg(x::float)::vector(384) 
      FROM jsonb_array_elements_text(ingredient_record->'embedding') x
    );
    
    RETURN QUERY
    SELECT 
      ingredient_record->>'name' AS ingredient_name,
      sp.id AS product_id,
      sp.name AS product_name,
      sp.brand,
      sp.price,
      sp.price_per_unit,
      sp.unit,
      sp.size_format,
      sp.category,
      sp.image_url,
      1 - (sp.embedding <=> ingredient_embedding) AS similarity
    FROM supermarket_products sp
    WHERE 
      sp.embedding IS NOT NULL
      AND sp.available = true
      AND (filter_supermarket IS NULL OR sp.supermarket_id = filter_supermarket)
      AND 1 - (sp.embedding <=> ingredient_embedding) > match_threshold
    ORDER BY sp.embedding <=> ingredient_embedding
    LIMIT matches_per_ingredient;
  END LOOP;
END;
$$;

-- ============================================
-- Hybrid Search Function (Semantic + Full-text)
-- ============================================

-- Combines vector similarity with full-text search for better results
CREATE OR REPLACE FUNCTION search_products_hybrid(
  search_text text,
  query_embedding vector(384),
  semantic_weight float DEFAULT 0.7, -- 0-1, higher = more semantic
  match_count int DEFAULT 10,
  filter_supermarket text DEFAULT NULL,
  filter_available boolean DEFAULT true
)
RETURNS TABLE (
  id uuid,
  supermarket_id text,
  name text,
  brand text,
  price decimal,
  price_per_unit decimal,
  unit text,
  size_format text,
  category text,
  image_url text,
  available boolean,
  semantic_score float,
  text_score float,
  combined_score float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH semantic_results AS (
    SELECT 
      sp.id,
      1 - (sp.embedding <=> query_embedding) AS semantic_score
    FROM supermarket_products sp
    WHERE 
      sp.embedding IS NOT NULL
      AND (filter_supermarket IS NULL OR sp.supermarket_id = filter_supermarket)
      AND (NOT filter_available OR sp.available = true)
  ),
  text_results AS (
    SELECT 
      sp.id,
      ts_rank(
        to_tsvector('spanish', coalesce(sp.name, '') || ' ' || coalesce(sp.brand, '') || ' ' || coalesce(sp.category, '')),
        plainto_tsquery('spanish', search_text)
      ) AS text_score
    FROM supermarket_products sp
    WHERE 
      (filter_supermarket IS NULL OR sp.supermarket_id = filter_supermarket)
      AND (NOT filter_available OR sp.available = true)
  )
  SELECT 
    sp.id,
    sp.supermarket_id,
    sp.name,
    sp.brand,
    sp.price,
    sp.price_per_unit,
    sp.unit,
    sp.size_format,
    sp.category,
    sp.image_url,
    sp.available,
    COALESCE(sr.semantic_score, 0) AS semantic_score,
    COALESCE(tr.text_score, 0) AS text_score,
    (semantic_weight * COALESCE(sr.semantic_score, 0) + (1 - semantic_weight) * COALESCE(tr.text_score, 0)) AS combined_score
  FROM supermarket_products sp
  LEFT JOIN semantic_results sr ON sp.id = sr.id
  LEFT JOIN text_results tr ON sp.id = tr.id
  WHERE 
    (filter_supermarket IS NULL OR sp.supermarket_id = filter_supermarket)
    AND (NOT filter_available OR sp.available = true)
    AND (COALESCE(sr.semantic_score, 0) > 0.3 OR COALESCE(tr.text_score, 0) > 0)
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;

-- ============================================
-- Embedding Stats View
-- ============================================

CREATE OR REPLACE VIEW product_embedding_stats AS
SELECT 
  supermarket_id,
  COUNT(*) AS total_products,
  COUNT(embedding) AS embedded_products,
  ROUND(COUNT(embedding)::decimal / COUNT(*)::decimal * 100, 2) AS embedded_percentage,
  MAX(embedded_at) AS last_embedded_at
FROM supermarket_products
GROUP BY supermarket_id;

-- Grant permissions
GRANT EXECUTE ON FUNCTION search_products_semantic TO authenticated, anon;
GRANT EXECUTE ON FUNCTION search_products_batch TO authenticated, anon;
GRANT EXECUTE ON FUNCTION search_products_hybrid TO authenticated, anon;
GRANT SELECT ON product_embedding_stats TO authenticated;

COMMENT ON FUNCTION search_products_semantic IS 'Semantic product search using vector similarity';
COMMENT ON FUNCTION search_products_batch IS 'Batch semantic search for multiple ingredients';
COMMENT ON FUNCTION search_products_hybrid IS 'Combined semantic + full-text search';
COMMENT ON COLUMN supermarket_products.embedding IS '384-dim embedding vector (all-MiniLM-L6-v2)';
