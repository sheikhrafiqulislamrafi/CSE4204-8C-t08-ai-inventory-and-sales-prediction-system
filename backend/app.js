/**
 * myShop AI - Express Backend (Full Python FastAPI Implementation)
 *
 * This is a complete Node.js implementation matching the Python FastAPI reference project.
 * All endpoints, response structures, and functionality match exactly.
 */

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8000;

// Database configuration
const { pool, query, queryOne, queryAll } = require('./src/config/db');

// CORS configuration
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
  : ['*'];

app.use(cors({
  origin: corsOrigins[0] === '*' ? '*' : corsOrigins,
  credentials: corsOrigins[0] !== '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
const authRoutes = require('./src/routes/auth');
const orderRoutes = require('./src/routes/orders');
const productRoutes = require('./src/routes/products');
const investmentRoutes = require('./src/routes/investments');
const analyticsRoutes = require('./src/routes/analytics');
const customerRoutes = require('./src/routes/customers');
const staffRoutes = require('./src/routes/staff');
const settingsRoutes = require('./src/routes/settings');
const sheetsRoutes = require('./src/routes/sheets');
const aiRoutes = require('./src/routes/ai');
const auditRoutes = require('./src/routes/audit');

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/products', productRoutes);
app.use('/api/investments', investmentRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/sheets', sheetsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/audit-log', auditRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'myShop AI', version: '2.0.0' });
});

app.get('/', (req, res) => {
  res.json({
    message: 'myShop AI Backend API',
    version: '2.0.0',
    status: 'healthy',
    endpoints: {
      auth: '/api/auth/*',
      orders: '/api/orders/*',
      products: '/api/products/*',
      investments: '/api/investments/*',
      analytics: '/api/analytics/*',
      customers: '/api/customers/*',
      staff: '/api/staff/*',
      settings: '/api/settings/*',
      sheets: '/api/sheets/*',
      ai: '/api/ai/*',
      audit: '/api/audit-log/*'
    }
  });
});

// Database initialization
async function initializeDatabase() {
  try {
    console.log('Initializing database...');

    // Create tables if they don't exist
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        hashed_password TEXT NOT NULL,
        business_name VARCHAR(255),
        full_name VARCHAR(255),
        role VARCHAR(50) DEFAULT 'owner',
        parent_id INTEGER REFERENCES users(id),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createOrdersTable = `
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        date VARCHAR(10) NOT NULL,
        consignment_id VARCHAR(255),
        order_id VARCHAR(255),
        customer_name VARCHAR(255),
        customer_phone VARCHAR(255),
        product_name VARCHAR(255),
        product_id VARCHAR(255),
        quantity INTEGER DEFAULT 1,
        amount DECIMAL(12, 2) DEFAULT 0.0,
        delivery_cost DECIMAL(12, 2) DEFAULT 100.0,
        product_cost DECIMAL(12, 2) DEFAULT 0.0,
        profit DECIMAL(12, 2) DEFAULT 0.0,
        status VARCHAR(50) DEFAULT 'delivered',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_order_user UNIQUE(user_id, order_id)
      )
    `;

    const createProductsTable = `
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        sku VARCHAR(255),
        name VARCHAR(255) NOT NULL,
        category VARCHAR(255),
        supplier VARCHAR(255),
        unit_cost DECIMAL(12, 2) DEFAULT 0.0,
        sell_price DECIMAL(12, 2) DEFAULT 0.0,
        current_stock INTEGER DEFAULT 0,
        reorder_level INTEGER DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_sku_user UNIQUE(user_id, sku)
      )
    `;

    const createInvestmentsTable = `
      CREATE TABLE IF NOT EXISTS investments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        date VARCHAR(10) NOT NULL,
        category VARCHAR(255) DEFAULT 'Other',
        amount DECIMAL(12, 2) DEFAULT 0.0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createUserSettingsTable = `
      CREATE TABLE IF NOT EXISTS user_settings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
        delivery_cost_per_order DECIMAL(12, 2) DEFAULT 100.0,
        notification_email VARCHAR(255),
        google_sheet_id VARCHAR(255),
        google_credentials TEXT,
        gemini_api_key VARCHAR(255),
        report_time VARCHAR(10) DEFAULT '20:00',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createAuditLogTable = `
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        owner_id INTEGER NOT NULL REFERENCES users(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        user_email VARCHAR(255) NOT NULL,
        action VARCHAR(50) NOT NULL,
        entity VARCHAR(50) NOT NULL,
        entity_id INTEGER,
        summary TEXT NOT NULL,
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await pool.query(createUsersTable);
    await pool.query(createOrdersTable);
    await pool.query(createProductsTable);
    await pool.query(createInvestmentsTable);
    await pool.query(createUserSettingsTable);
    await pool.query(createAuditLogTable);

    // Support databases created by earlier backend versions. The routes use user_id,
    // so migrate the old owner_id naming once before serving API requests.
    for (const table of ['orders', 'products', 'investments']) {
      const hasOwnerId = await queryOne(
        `SELECT 1 FROM information_schema.columns
         WHERE table_schema = current_schema() AND table_name = $1 AND column_name = 'owner_id'`,
        [table]
      );
      const hasUserId = await queryOne(
        `SELECT 1 FROM information_schema.columns
         WHERE table_schema = current_schema() AND table_name = $1 AND column_name = 'user_id'`,
        [table]
      );

      if (hasOwnerId && !hasUserId) {
        await pool.query(`ALTER TABLE ${table} RENAME COLUMN owner_id TO user_id`);
      }
    }

    // Keep the settings column compatible with the settings route and all order uploads.
    await pool.query(
      'ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS delivery_cost_per_order DECIMAL(12, 2) DEFAULT 100.0'
    );
    await pool.query(
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
    );
    await pool.query(
      'ALTER TABLE investments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
    );
    await pool.query(
      'ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
    );

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({
    detail: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
async function startServer() {
  try {
    await initializeDatabase();

    app.listen(PORT, () => {
      console.log(`myShop AI Backend is running on port ${PORT}`);
      console.log(`CORS origins: ${corsOrigins.join(', ')}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start server if not in test mode
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };