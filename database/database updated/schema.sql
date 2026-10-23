-- myShop AI - PostgreSQL Schema
-- Raw SQL schema (no ORM). Run this to initialize the database.

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  hashed_password VARCHAR(255) NOT NULL,
  business_name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'owner',
  parent_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE,
  consignment_id VARCHAR(255),
  order_id VARCHAR(255),
  customer_name VARCHAR(255),
  customer_phone VARCHAR(255),
  product_name VARCHAR(255),
  product_id INTEGER,
  quantity INTEGER DEFAULT 0,
  amount NUMERIC(12,2) DEFAULT 0,
  delivery_cost NUMERIC(12,2) DEFAULT 0,
  product_cost NUMERIC(12,2) DEFAULT 0,
  profit NUMERIC(12,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS investments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE,
  category VARCHAR(255),
  amount NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sku VARCHAR(255),
  name VARCHAR(255),
  category VARCHAR(255),
  supplier VARCHAR(255),
  unit_cost NUMERIC(12,2) DEFAULT 0,
  sell_price NUMERIC(12,2) DEFAULT 0,
  current_stock INTEGER DEFAULT 0,
  reorder_level INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  delivery_cost NUMERIC(12,2) DEFAULT 0,
  notification_email VARCHAR(255),
  google_sheet_id VARCHAR(255),
  google_credentials TEXT,
  gemini_api_key VARCHAR(255),
  report_time VARCHAR(50) DEFAULT '08:00'
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  user_email VARCHAR(255),
  action VARCHAR(100),
  entity VARCHAR(100),
  entity_id INTEGER,
  summary TEXT,
  details TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(date);
CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_investments_user_id ON investments(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_owner_id ON audit_logs(owner_id);
