-- Migration: Supermarket Products Catalog
-- Stores products from supermarkets for instant price lookups

-- Products table
CREATE TABLE IF NOT EXISTS supermarket_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Supermarket info
  supermarket_id TEXT NOT NULL, -- 'mercadona', 'carrefour', etc.
  external_id TEXT NOT NULL,    -- Product ID from the supermarket
  
  -- Product info
  name TEXT NOT NULL,
  description TEXT,
  brand TEXT,
  
  -- Pricing
  price DECIMAL(10, 2) NOT NULL,
  price_per_unit DECIMAL(10, 2),
  unit TEXT, -- 'kg', 'l', 'unit', etc.
  size DECIMAL(10, 3),
  size_format TEXT, -- '1 kg', '500 ml', etc.
  
  -- Categorization
  category TEXT,
  subcategory TEXT,
  
  -- Media
  image_url TEXT,
  thumbnail_url TEXT,
  
  -- Status
  available BOOLEAN DEFAULT true,
  
  -- Metadata (JSON for flexibility)
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint: one product per supermarket
  UNIQUE(supermarket_id, external_id)
);

-- Categories table
CREATE TABLE IF NOT EXISTS supermarket_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supermarket_id TEXT NOT NULL,
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_id TEXT,
  order_index INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(supermarket_id, external_id)
);

-- Price history for tracking changes
CREATE TABLE IF NOT EXISTS supermarket_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES supermarket_products(id) ON DELETE CASCADE,
  old_price DECIMAL(10, 2),
  new_price DECIMAL(10, 2) NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sync status table
CREATE TABLE IF NOT EXISTS supermarket_sync_status (
  supermarket_id TEXT PRIMARY KEY,
  last_sync_started_at TIMESTAMPTZ,
  last_sync_completed_at TIMESTAMPTZ,
  last_sync_status TEXT, -- 'success', 'failed', 'in_progress'
  products_synced INTEGER DEFAULT 0,
  categories_synced INTEGER DEFAULT 0,
  error_message TEXT,
  
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_products_supermarket ON supermarket_products(supermarket_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON supermarket_products USING gin(to_tsvector('spanish', name));
CREATE INDEX IF NOT EXISTS idx_products_category ON supermarket_products(category);
CREATE INDEX IF NOT EXISTS idx_products_price ON supermarket_products(price);
CREATE INDEX IF NOT EXISTS idx_products_available ON supermarket_products(available) WHERE available = true;

-- Full-text search index for ingredient matching
CREATE INDEX IF NOT EXISTS idx_products_search ON supermarket_products 
  USING gin(to_tsvector('spanish', coalesce(name, '') || ' ' || coalesce(brand, '') || ' ' || coalesce(category, '')));

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_supermarket_products_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-updating timestamp
DROP TRIGGER IF EXISTS update_supermarket_products_timestamp ON supermarket_products;
CREATE TRIGGER update_supermarket_products_timestamp
  BEFORE UPDATE ON supermarket_products
  FOR EACH ROW
  EXECUTE FUNCTION update_supermarket_products_timestamp();

-- Insert initial sync status for Mercadona
INSERT INTO supermarket_sync_status (supermarket_id, last_sync_status)
VALUES ('mercadona', 'pending')
ON CONFLICT (supermarket_id) DO NOTHING;

COMMENT ON TABLE supermarket_products IS 'Cached product catalog from supermarkets for instant price lookups';
COMMENT ON TABLE supermarket_price_history IS 'Historical price changes for analytics';
COMMENT ON TABLE supermarket_sync_status IS 'Tracks sync status and metrics per supermarket';
