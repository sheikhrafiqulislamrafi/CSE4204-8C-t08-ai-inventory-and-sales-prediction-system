/**
 * Orders Routes
 * Complete implementation matching Python FastAPI reference
 */

const express = require('express');
const router = express.Router();
const { query, queryOne, queryAll, _roundMoney, _orderSign } = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');
const { upload, parseOrdersExcel } = require('../middleware/uploadMiddleware');

// Apply auth middleware to all routes
router.use(authMiddleware);

// Get all orders with pagination and filtering
router.get('/', async (req, res) => {
  try {
    const { search, status, start_date, end_date, page = 1, limit = 50 } = req.query;
    const userId = req.businessOwnerId;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let sql = `SELECT * FROM orders WHERE user_id = $1`;
    const params = [userId];
    let paramIndex = 2;

    if (search) {
      sql += ` AND (
        customer_name ILIKE $${paramIndex} OR
        customer_phone ILIKE $${paramIndex} OR
        order_id ILIKE $${paramIndex} OR
        product_name ILIKE $${paramIndex} OR
        product_id ILIKE $${paramIndex} OR
        consignment_id ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    if (status) {
      sql += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    if (start_date) {
      sql += ` AND date >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }
    if (end_date) {
      sql += ` AND date <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    // Get total count
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
    const totalResult = await queryOne(countSql, params);
    const total = parseInt(totalResult?.total || 0);

    // Get paginated results
    sql += ` ORDER BY date DESC, id DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), offset);

    const orders = await queryAll(sql, params);

    res.json({
      items: orders,
      total,
      page: parseInt(page),
      pages: Math.max(1, Math.ceil(total / parseInt(limit)))
    });
  } catch (err) {
    console.error('Get orders error:', err);
    res.status(500).json({ detail: 'Failed to fetch orders' });
  }
});

// Create a single order
router.post('/', async (req, res) => {
  try {
    const userId = req.businessOwnerId;
    const {
      date,
      consignment_id,
      order_id,
      customer_name,
      customer_phone,
      product_name,
      product_id,
      quantity = 1,
      amount,
      delivery_cost,
      product_cost = 0,
      status = 'delivered',
      notes
    } = req.body;

    // Get user's delivery cost setting
    const settings = await queryOne(
      'SELECT delivery_cost_per_order FROM user_settings WHERE user_id = $1',
      [userId]
    );
    const dc = delivery_cost !== undefined ? delivery_cost : (settings?.delivery_cost_per_order || 100);

    // Calculate profit
    const profit = _roundMoney((amount || 0) - (product_cost || 0));

    // Generate order_id if not provided
    let finalOrderId = order_id;
    if (!finalOrderId) {
      const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
      const uuidPart = Math.random().toString(36).substring(2, 6).toUpperCase();
      finalOrderId = `ORD-${timestamp}-${uuidPart}`;
    }

    // Check for duplicate order_id
    const existing = await queryOne(
      'SELECT id FROM orders WHERE user_id = $1 AND order_id = $2',
      [userId, finalOrderId]
    );
    if (existing) {
      return res.status(400).json({ detail: 'Order ID already exists' });
    }

    const result = await queryOne(
      `INSERT INTO orders (user_id, date, consignment_id, order_id, customer_name, customer_phone, product_name, product_id, quantity, amount, delivery_cost, product_cost, profit, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [userId, date, consignment_id || null, finalOrderId, customer_name || null, customer_phone || null, product_name || null, product_id || null, quantity, amount, dc, product_cost, profit, status, notes || null]
    );

    res.status(201).json(result);
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ detail: 'Failed to create order' });
  }
});

// Bulk upload orders
router.post('/bulk-upload', upload.single('file'), async (req, res) => {
  try {
    let orders;

    // Check if file was uploaded or JSON was sent
    if (req.file) {
      // Parse Excel/CSV file
      orders = parseOrdersExcel(req.file.buffer, req.file.originalname);
    } else if (req.body.data) {
      // JSON data sent
      orders = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body.data;
    } else if (Array.isArray(req.body)) {
      // Direct JSON array
      orders = req.body;
    } else {
      return res.status(400).json({ detail: 'No file or data provided' });
    }

    if (!Array.isArray(orders)) {
      return res.status(400).json({ detail: 'Expected array of orders' });
    }

    // Validate required columns
    if (!orders[0]?.Amount && !orders[0]?.amount) {
      return res.status(422).json({ detail: 'File must contain an Amount column' });
    }
    if (!orders[0]?.Date && !orders[0]?.date) {
      return res.status(422).json({ detail: 'File must contain a Date column' });
    }

    const userId = req.businessOwnerId;

    // Get user's delivery cost setting
    const settings = await queryOne(
      'SELECT delivery_cost_per_order FROM user_settings WHERE user_id = $1',
      [userId]
    );
    const defaultDeliveryCost = settings?.delivery_cost_per_order || 100;

    const inserted = [];
    const errors = [];

    for (let i = 0; i < orders.length; i++) {
      try {
        const order = orders[i];

        // Clean amount
        let amount = 0;
        const amountVal = order.Amount || order.amount || 0;
        if (typeof amountVal === 'string') {
          amount = parseFloat(amountVal.replace(/[৳,]/g, '')) || 0;
        } else {
          amount = parseFloat(amountVal) || 0;
        }

        if (amount <= 0) continue;

        // Parse date
        let dateStr = order.Date || order.date;
        if (!dateStr) continue;

        // Handle date parsing
        const dateObj = new Date(dateStr);
        if (isNaN(dateObj.getTime())) continue;
        dateStr = dateObj.toISOString().split('T')[0];

        // Extract other fields
        const customerName = String(order['Customer Name'] || order.customer_name || '').replace(/^Name: /, '').trim();
        const customerPhone = String(order['Customer Phone'] || order.customer_phone || '').trim();
        const productName = String(order['Product Name'] || order.product || order.product_name || '').trim();
        const productId = String(order['Product ID'] || order.SKU || order.product_id || '').trim();
        const consignmentId = String(order['Consignment ID'] || order.consignment_id || '').replace('#', '').trim();
        const orderId = String(order['Order ID'] || order.order_id || '').replace('#', '').trim();

        let deliveryCost = order['Delivery Cost'] || order.delivery_cost;
        if (deliveryCost) {
          if (typeof deliveryCost === 'string') {
            deliveryCost = parseFloat(deliveryCost.replace(/[৳,]/g, '')) || defaultDeliveryCost;
          } else {
            deliveryCost = parseFloat(deliveryCost) || defaultDeliveryCost;
          }
        } else {
          deliveryCost = defaultDeliveryCost;
        }

        let productCost = order['Product Cost'] || order.Cost || order.product_cost || 0;
        if (typeof productCost === 'string') {
          productCost = parseFloat(productCost.replace(/[৳,]/g, '')) || 0;
        } else {
          productCost = parseFloat(productCost) || 0;
        }

        const profit = _roundMoney(amount - productCost);

        const result = await queryOne(
          `INSERT INTO orders (user_id, date, consignment_id, order_id, customer_name, customer_phone, product_name, product_id, quantity, amount, delivery_cost, product_cost, profit, status, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           RETURNING id, order_id, customer_name, amount`,
          [userId, dateStr, consignmentId || null, orderId || null, customerName || null, customerPhone || null, productName || null, productId || null, 1, amount, deliveryCost, productCost, profit, 'delivered', null]
        );
        inserted.push(result);
      } catch (err) {
        errors.push({ row: i + 1, error: err.message });
      }
    }

    // Get analytics context for AI
    const allOrders = await queryAll(
      'SELECT * FROM orders WHERE user_id = $1',
      [userId]
    );
    const totalRev = allOrders.reduce((sum, o) => sum + _orderSign(o.status) * (o.amount || 0), 0);
    const totalProfit = allOrders.reduce((sum, o) => sum + _orderSign(o.status) * (o.profit || 0), 0);
    const nOrders = allOrders.length;
    const uniquePhones = [...new Set(allOrders.map(o => o.customer_phone).filter(Boolean))];
    const aov = totalRev / nOrders || 0;

    // Calculate at-risk customers
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const atRisk = uniquePhones.filter(phone =>
      allOrders.some(o => o.customer_phone === phone && o.date && o.date < cutoff) &&
      !allOrders.some(o => o.customer_phone === phone && o.date && o.date >= cutoff)
    ).length;

    // Top customers
    const customerSpent = {};
    for (const o of allOrders) {
      if (o.customer_phone) {
        if (!customerSpent[o.customer_phone]) {
          customerSpent[o.customer_phone] = { phone: o.customer_phone, orders: 0, spent: 0 };
        }
        customerSpent[o.customer_phone].orders++;
        customerSpent[o.customer_phone].spent += _orderSign(o.status) * (o.amount || 0);
      }
    }
    const topCustomers = Object.values(customerSpent)
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 3);

    res.status(201).json({
      imported: inserted.length,
      total_orders: nOrders,
      total_revenue: _roundMoney(totalRev),
      total_profit: _roundMoney(totalProfit),
      unique_customers: uniquePhones.length,
      top_customers: topCustomers,
      at_risk_customers: atRisk,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err) {
    console.error('Bulk upload orders error:', err);
    res.status(500).json({ detail: 'Failed to import orders: ' + err.message });
  }
});

// Update order
router.put('/:id', async (req, res) => {
  try {
    const userId = req.businessOwnerId;
    const orderId = parseInt(req.params.id);
    const {
      date,
      consignment_id,
      order_id,
      customer_name,
      customer_phone,
      product_name,
      product_id,
      quantity,
      amount,
      delivery_cost,
      product_cost,
      status,
      notes
    } = req.body;

    // Check if order exists
    const existing = await queryOne(
      'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
      [orderId, userId]
    );
    if (!existing) {
      return res.status(404).json({ detail: 'Order not found' });
    }

    // Calculate new profit if amount or product_cost changed
    const newAmount = amount !== undefined ? amount : existing.amount;
    const newProductCost = product_cost !== undefined ? product_cost : existing.product_cost;
    const newDeliveryCost = delivery_cost !== undefined ? delivery_cost : existing.delivery_cost;
    const profit = _roundMoney(newAmount - newProductCost);

    const result = await queryOne(
      `UPDATE orders SET
        date = COALESCE($2, date),
        consignment_id = COALESCE($3, consignment_id),
        order_id = COALESCE($4, order_id),
        customer_name = COALESCE($5, customer_name),
        customer_phone = COALESCE($6, customer_phone),
        product_name = COALESCE($7, product_name),
        product_id = COALESCE($8, product_id),
        quantity = COALESCE($9, quantity),
        amount = COALESCE($10, amount),
        delivery_cost = COALESCE($11, delivery_cost),
        product_cost = COALESCE($12, product_cost),
        profit = $13,
        status = COALESCE($14, status),
        notes = COALESCE($15, notes),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $16
       RETURNING *`,
      [orderId, date, consignment_id, order_id, customer_name, customer_phone, product_name, product_id, quantity, amount, delivery_cost, product_cost, profit, status, notes, userId]
    );

    res.json(result);
  } catch (err) {
    console.error('Update order error:', err);
    res.status(500).json({ detail: 'Failed to update order' });
  }
});

// Delete order
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.businessOwnerId;
    const orderId = parseInt(req.params.id);

    const existing = await queryOne(
      'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
      [orderId, userId]
    );
    if (!existing) {
      return res.status(404).json({ detail: 'Order not found' });
    }

    await query('DELETE FROM orders WHERE id = $1 AND user_id = $2', [orderId, userId]);
    res.json({ message: 'Order deleted' });
  } catch (err) {
    console.error('Delete order error:', err);
    res.status(500).json({ detail: 'Failed to delete order' });
  }
});

module.exports = router;