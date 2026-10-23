/**
 * Products Routes
 * Complete implementation matching Python FastAPI reference
 */

const express = require('express');
const router = express.Router();
const { query, queryOne, queryAll, _roundMoney } = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');
const { upload, parseProductsExcel } = require('../middleware/uploadMiddleware');

router.use(authMiddleware);

// Get all products
router.get('/', async (req, res) => {
  try {
    const userId = req.businessOwnerId;
    const products = await queryAll(
      'SELECT * FROM products WHERE user_id = $1 ORDER BY name ASC',
      [userId]
    );
    res.json(products.map(p => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      category: p.category,
      supplier: p.supplier,
      unit_cost: _roundMoney(p.unit_cost),
      sell_price: _roundMoney(p.sell_price),
      current_stock: parseInt(p.current_stock || 0),
      reorder_level: parseInt(p.reorder_level || 0),
      status: getProductStatus(p),
      notes: p.notes,
      created_at: p.created_at,
      updated_at: p.updated_at
    })));
  } catch (err) {
    console.error('Get products error:', err);
    res.status(500).json({ detail: 'Failed to fetch products' });
  }
});

function getProductStatus(product) {
  const stock = parseInt(product.current_stock || 0);
  const reorder = parseInt(product.reorder_level || 0);
  if (stock <= 0) return 'Out of Stock';
  if (stock <= reorder) return 'Low Stock';
  return 'In Stock';
}

// Create product
router.post('/', async (req, res) => {
  try {
    const userId = req.businessOwnerId;
    const { sku, name, category, supplier, unit_cost = 0, sell_price = 0, current_stock = 0, reorder_level = 0, notes } = req.body;

    // Check SKU uniqueness
    if (sku) {
      const existing = await queryOne(
        'SELECT id FROM products WHERE user_id = $1 AND sku = $2',
        [userId, sku]
      );
      if (existing) {
        return res.status(400).json({ detail: 'SKU already exists' });
      }
    }

    const result = await queryOne(
      `INSERT INTO products (user_id, sku, name, category, supplier, unit_cost, sell_price, current_stock, reorder_level, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [userId, sku || null, name, category || null, supplier || null, unit_cost, sell_price, current_stock, reorder_level, notes || null]
    );

    res.status(201).json(result);
  } catch (err) {
    console.error('Create product error:', err);
    res.status(500).json({ detail: 'Failed to create product' });
  }
});

// Bulk upload products
router.post('/bulk-upload', upload.single('file'), async (req, res) => {
  try {
    let products;

    if (req.file) {
      products = parseProductsExcel(req.file.buffer, req.file.originalname);
    } else if (req.body.data) {
      products = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body.data;
    } else if (Array.isArray(req.body)) {
      products = req.body;
    } else {
      return res.status(400).json({ detail: 'No file or data provided' });
    }

    if (!Array.isArray(products)) {
      return res.status(400).json({ detail: 'Expected array of products' });
    }

    // Validate required column
    if (!products[0]?.Name && !products[0]?.name) {
      return res.status(422).json({ detail: 'File must contain a Name column' });
    }

    const userId = req.businessOwnerId;
    let imported = 0;
    let updated = 0;

    for (const p of products) {
      const name = String(p.Name || p.name || '').trim();
      if (!name || name.toLowerCase() === 'nan') continue;

      const sku = String(p.SKU || p.sku || '').trim();
      const category = String(p.Category || p.category || '').trim();
      const supplier = String(p.Supplier || p.supplier || '').trim();

      let unitCost = 0, sellPrice = 0, currentStock = 0, reorderLevel = 0;

      const unitCostVal = p['Unit Cost'] || p.unit_cost || 0;
      unitCost = typeof unitCostVal === 'string' ? parseFloat(unitCostVal.replace(/[৳,]/g, '')) || 0 : parseFloat(unitCostVal) || 0;

      const sellPriceVal = p['Sell Price'] || p.sell_price || 0;
      sellPrice = typeof sellPriceVal === 'string' ? parseFloat(sellPriceVal.replace(/[৳,]/g, '')) || 0 : parseFloat(sellPriceVal) || 0;

      const stockVal = p['Current Stock'] || p.Stock || p.current_stock || 0;
      currentStock = typeof stockVal === 'string' ? parseInt(stockVal.replace(/[৳,]/g, '')) || 0 : parseInt(stockVal) || 0;

      const reorderVal = p['Reorder Level'] || p.reorder_level || 0;
      reorderLevel = typeof reorderVal === 'string' ? parseInt(reorderVal.replace(/[৳,]/g, '')) || 0 : parseInt(reorderVal) || 0;

      const notes = String(p.Notes || p.notes || '').trim();

      // Check if product exists
      let existing = null;
      if (sku && sku.toLowerCase() !== 'nan' && sku) {
        existing = await queryOne(
          'SELECT id FROM products WHERE user_id = $1 AND sku = $2',
          [userId, sku]
        );
      }
      if (!existing) {
        existing = await queryOne(
          'SELECT id FROM products WHERE user_id = $1 AND LOWER(name) = LOWER($2)',
          [userId, name]
        );
      }

      if (existing) {
        await query(
          `UPDATE products SET
            sku = COALESCE(NULLIF($3, ''), sku),
            category = COALESCE(NULLIF($4, ''), category),
            supplier = COALESCE(NULLIF($5, ''), supplier),
            unit_cost = $6,
            sell_price = $7,
            current_stock = $8,
            reorder_level = $9,
            notes = COALESCE(NULLIF($10, ''), notes),
            updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 AND user_id = $2`,
          [existing.id, userId, sku || null, category || null, supplier || null, unitCost, sellPrice, currentStock, reorderLevel, notes || null]
        );
        updated++;
      } else {
        await query(
          `INSERT INTO products (user_id, sku, name, category, supplier, unit_cost, sell_price, current_stock, reorder_level, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [userId, sku || null, name, category || null, supplier || null, unitCost, sellPrice, currentStock, reorderLevel, notes || null]
        );
        imported++;
      }
    }

    res.status(201).json({
      message: `Successfully added ${imported} and updated ${updated} products.`,
      imported,
      updated
    });
  } catch (err) {
    console.error('Bulk upload products error:', err);
    res.status(500).json({ detail: 'Failed to import products: ' + err.message });
  }
});

// Update product
router.put('/:id', async (req, res) => {
  try {
    const userId = req.businessOwnerId;
    const productId = parseInt(req.params.id);
    const { sku, name, category, supplier, unit_cost, sell_price, current_stock, reorder_level, notes } = req.body;

    const existing = await queryOne(
      'SELECT * FROM products WHERE id = $1 AND user_id = $2',
      [productId, userId]
    );
    if (!existing) {
      return res.status(404).json({ detail: 'Product not found' });
    }

    // Check SKU uniqueness if changing
    if (sku && sku !== existing.sku) {
      const duplicate = await queryOne(
        'SELECT id FROM products WHERE user_id = $1 AND sku = $2 AND id != $3',
        [userId, sku, productId]
      );
      if (duplicate) {
        return res.status(400).json({ detail: 'SKU already exists' });
      }
    }

    const result = await queryOne(
      `UPDATE products SET
        sku = COALESCE($2, sku),
        name = COALESCE($3, name),
        category = COALESCE($4, category),
        supplier = COALESCE($5, supplier),
        unit_cost = COALESCE($6, unit_cost),
        sell_price = COALESCE($7, sell_price),
        current_stock = COALESCE($8, current_stock),
        reorder_level = COALESCE($9, reorder_level),
        notes = COALESCE($10, notes),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $11
       RETURNING *`,
      [productId, sku, name, category, supplier, unit_cost, sell_price, current_stock, reorder_level, notes, userId]
    );

    res.json(result);
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ detail: 'Failed to update product' });
  }
});

// Delete product
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.businessOwnerId;
    const productId = parseInt(req.params.id);

    const existing = await queryOne(
      'SELECT * FROM products WHERE id = $1 AND user_id = $2',
      [productId, userId]
    );
    if (!existing) {
      return res.status(404).json({ detail: 'Product not found' });
    }

    await query('DELETE FROM products WHERE id = $1 AND user_id = $2', [productId, userId]);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ detail: 'Failed to delete product' });
  }
});

module.exports = router;