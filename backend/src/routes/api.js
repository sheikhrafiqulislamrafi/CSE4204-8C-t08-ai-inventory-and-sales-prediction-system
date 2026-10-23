
const express = require('express');
const { query, queryOne, queryAll } = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
const { upload, parseOrdersCSV, parseProductsCSV, parseInvestmentsCSV } = require('../middleware/uploadMiddleware');


router.use(authMiddleware);



router.get('/orders', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    let sql = 'SELECT * FROM orders WHERE user_id = $1';
    const params = [req.user.user_id];

    if (start_date && end_date) {
      sql += ' AND date BETWEEN $2 AND $3';
      params.push(start_date, end_date);
    }
    sql += ' ORDER BY date DESC';

    const orders = await queryAll(sql, params);
    res.json(orders);
  } catch (err) {
    console.error('Get orders error:', err);
    res.status(500).json({ detail: 'Failed to fetch orders' });
  }
});

router.post('/orders', async (req, res) => {
  try {
    const { date, consignment_id, order_id, customer_name, customer_phone, product_name, quantity, amount, delivery_cost, product_cost, status, notes } = req.body;
    const profit = (amount || 0) - (product_cost || 0) - (delivery_cost || 0);

    const result = await queryOne(
      `INSERT INTO orders (user_id, date, consignment_id, order_id, customer_name, customer_phone, product_name, quantity, amount, delivery_cost, product_cost, profit, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [req.user.user_id, date, consignment_id, order_id, customer_name, customer_phone, product_name, quantity, amount, delivery_cost, product_cost, profit, status, notes]
    );

    res.status(201).json(result);
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ detail: 'Failed to create order' });
  }
});

router.post('/orders/bulk-upload', upload.single('file'), async (req, res) => {
  try {
    let orders;


    if (req.file) {

      orders = parseOrdersCSV(req.file.buffer);
    } else if (req.body.data) {

      orders = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body.data;
    } else if (Array.isArray(req.body)) {

      orders = req.body;
    } else {
      return res.status(400).json({ detail: 'No file or data provided' });
    }

    if (!Array.isArray(orders)) {
      return res.status(400).json({ detail: 'Expected array of orders' });
    }

    const inserted = [];
    const errors = [];
    for (let i = 0; i < orders.length; i++) {
      try {
        const order = orders[i];
        const profit = (order.amount || 0) - (order.product_cost || 0) - (order.delivery_cost || 0);
        const result = await queryOne(
          `INSERT INTO orders (user_id, date, consignment_id, order_id, customer_name, customer_phone, product_name, quantity, amount, delivery_cost, product_cost, profit, status, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           RETURNING id, order_id, customer_name, amount`,
          [req.user.user_id, order.date, order.consignment_id, order.order_id, order.customer_name, order.customer_phone, order.product_name, order.quantity, order.amount, order.delivery_cost, order.product_cost, profit, order.status || 'pending', order.notes]
        );
        inserted.push(result);
      } catch (err) {
        errors.push({ row: i + 1, error: err.message });
      }
    }

    res.status(201).json({
      detail: `${inserted.length} orders imported${errors.length > 0 ? `, ${errors.length} failed` : ''}`,
      imported: inserted,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err) {
    console.error('Bulk upload orders error:', err);
    res.status(500).json({ detail: 'Failed to import orders: ' + err.message });
  }
});

router.put('/orders/:id', async (req, res) => {
  try {
    const { date, customer_name, status, amount, notes } = req.body;
    const result = await queryOne(
      `UPDATE orders SET date=$1, customer_name=$2, status=$3, amount=$4, notes=$5 WHERE id=$6 AND user_id=$7 RETURNING *`,
      [date, customer_name, status, amount, notes, req.params.id, req.user.user_id]
    );
    res.json(result);
  } catch (err) {
    console.error('Update order error:', err);
    res.status(500).json({ detail: 'Failed to update order' });
  }
});

router.delete('/orders/:id', async (req, res) => {
  try {
    await query('DELETE FROM orders WHERE id = $1 AND user_id = $2', [req.params.id, req.user.user_id]);
    res.json({ detail: 'Order deleted' });
  } catch (err) {
    console.error('Delete order error:', err);
    res.status(500).json({ detail: 'Failed to delete order' });
  }
});



router.get('/products', async (req, res) => {
  try {
    const products = await queryAll('SELECT * FROM products WHERE user_id = $1 ORDER BY name', [req.user.user_id]);
    res.json(products);
  } catch (err) {
    console.error('Get products error:', err);
    res.status(500).json({ detail: 'Failed to fetch products' });
  }
});

router.post('/products', async (req, res) => {
  try {
    const { sku, name, category, supplier, unit_cost, sell_price, current_stock, reorder_level, notes } = req.body;
    const result = await queryOne(
      `INSERT INTO products (user_id, sku, name, category, supplier, unit_cost, sell_price, current_stock, reorder_level, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [req.user.user_id, sku, name, category, supplier, unit_cost, sell_price, current_stock, reorder_level, notes]
    );
    res.status(201).json(result);
  } catch (err) {
    console.error('Create product error:', err);
    res.status(500).json({ detail: 'Failed to create product' });
  }
});

router.post('/products/bulk-upload', upload.single('file'), async (req, res) => {
  try {
    let products;

    if (req.file) {
      products = parseProductsCSV(req.file.buffer);
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

    const inserted = [];
    const errors = [];
    for (let i = 0; i < products.length; i++) {
      try {
        const product = products[i];
        const result = await queryOne(
          `INSERT INTO products (user_id, sku, name, category, supplier, unit_cost, sell_price, current_stock, reorder_level, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id, name, sku`,
          [req.user.user_id, product.sku || null, product.name, product.category || null, product.supplier || null, product.unit_cost || 0, product.sell_price || 0, product.current_stock || 0, product.reorder_level || 0, product.notes || null]
        );
        inserted.push(result);
      } catch (err) {
        errors.push({ row: i + 1, error: err.message });
      }
    }

    res.status(201).json({
      detail: `${inserted.length} products imported${errors.length > 0 ? `, ${errors.length} failed` : ''}`,
      imported: inserted,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err) {
    console.error('Bulk upload products error:', err);
    res.status(500).json({ detail: 'Failed to import products: ' + err.message });
  }
});

router.put('/products/:id', async (req, res) => {
  try {
    const { name, category, unit_cost, sell_price, current_stock, notes } = req.body;
    const result = await queryOne(
      `UPDATE products SET name=$1, category=$2, unit_cost=$3, sell_price=$4, current_stock=$5, notes=$6
       WHERE id=$7 AND user_id=$8 RETURNING *`,
      [name, category, unit_cost, sell_price, current_stock, notes, req.params.id, req.user.user_id]
    );
    res.json(result);
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ detail: 'Failed to update product' });
  }
});

router.delete('/products/:id', async (req, res) => {
  try {
    await query('DELETE FROM products WHERE id = $1 AND user_id = $2', [req.params.id, req.user.user_id]);
    res.json({ detail: 'Product deleted' });
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ detail: 'Failed to delete product' });
  }
});



router.get('/investments', async (req, res) => {
  try {
    const investments = await queryAll('SELECT * FROM investments WHERE user_id = $1 ORDER BY date DESC', [req.user.user_id]);
    res.json(investments);
  } catch (err) {
    console.error('Get investments error:', err);
    res.status(500).json({ detail: 'Failed to fetch investments' });
  }
});

router.post('/investments', async (req, res) => {
  try {
    const { date, category, amount, notes } = req.body;
    const result = await queryOne(
      `INSERT INTO investments (user_id, date, category, amount, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.user_id, date, category, amount, notes]
    );
    res.status(201).json(result);
  } catch (err) {
    console.error('Create investment error:', err);
    res.status(500).json({ detail: 'Failed to create investment' });
  }
});

router.post('/investments/bulk-upload', upload.single('file'), async (req, res) => {
  try {
    let investments;

    if (req.file) {
      investments = parseInvestmentsCSV(req.file.buffer);
    } else if (req.body.data) {
      investments = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body.data;
    } else if (Array.isArray(req.body)) {
      investments = req.body;
    } else {
      return res.status(400).json({ detail: 'No file or data provided' });
    }

    if (!Array.isArray(investments)) {
      return res.status(400).json({ detail: 'Expected array of investments' });
    }

    const inserted = [];
    const errors = [];
    for (let i = 0; i < investments.length; i++) {
      try {
        const inv = investments[i];
        const result = await queryOne(
          `INSERT INTO investments (user_id, date, category, amount, notes)
           VALUES ($1, $2, $3, $4, $5) RETURNING id, date, category, amount`,
          [req.user.user_id, inv.date, inv.category, inv.amount, inv.notes || null]
        );
        inserted.push(result);
      } catch (err) {
        errors.push({ row: i + 1, error: err.message });
      }
    }

    res.status(201).json({
      detail: `${inserted.length} investments imported${errors.length > 0 ? `, ${errors.length} failed` : ''}`,
      imported: inserted,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err) {
    console.error('Bulk upload investments error:', err);
    res.status(500).json({ detail: 'Failed to import investments: ' + err.message });
  }
});

router.put('/investments/:id', async (req, res) => {
  try {
    const { date, category, amount, notes } = req.body;
    const result = await queryOne(
      `UPDATE investments SET date=$1, category=$2, amount=$3, notes=$4 WHERE id=$5 AND user_id=$6 RETURNING *`,
      [date, category, amount, notes, req.params.id, req.user.user_id]
    );
    res.json(result);
  } catch (err) {
    console.error('Update investment error:', err);
    res.status(500).json({ detail: 'Failed to update investment' });
  }
});

router.delete('/investments/:id', async (req, res) => {
  try {
    await query('DELETE FROM investments WHERE id = $1 AND user_id = $2', [req.params.id, req.user.user_id]);
    res.json({ detail: 'Investment deleted' });
  } catch (err) {
    console.error('Delete investment error:', err);
    res.status(500).json({ detail: 'Failed to delete investment' });
  }
});



router.get('/analytics/summary', async (req, res) => {
  try {
    const userId = req.user.user_id;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    const [{ total_revenue, total_profit, total_orders }] = await queryAll(`
      SELECT COALESCE(SUM(amount), 0) as total_revenue, COALESCE(SUM(profit), 0) as total_profit, COUNT(*) as total_orders
      FROM orders WHERE user_id = $1 AND date >= $2 AND status NOT IN ('cancelled', 'returned')`,
      [userId, thirtyDaysAgo]
    );

    const dailyAggregates = await queryAll(`
      SELECT date, SUM(amount) as revenue, SUM(profit) as profit, COUNT(*) as orders
      FROM orders WHERE user_id = $1 AND date >= $2 AND status NOT IN ('cancelled', 'returned')
      GROUP BY date ORDER BY date`,
      [userId, thirtyDaysAgo]
    );

    const topProducts = await queryAll(`
      SELECT product_name, SUM(quantity) as total_quantity, SUM(amount) as total_amount
      FROM orders WHERE user_id = $1 AND date >= $2 AND status NOT IN ('cancelled', 'returned')
      GROUP BY product_name ORDER BY total_amount DESC LIMIT 10`,
      [userId, thirtyDaysAgo]
    );

    res.json({
      total_revenue: parseFloat(total_revenue) || 0,
      total_profit: parseFloat(total_profit) || 0,
      total_orders: parseInt(total_orders) || 0,
      profit_margin: total_revenue > 0 ? (total_profit / total_revenue * 100).toFixed(2) : 0,
      daily_aggregates: dailyAggregates,
      top_products: topProducts
    });
  } catch (err) {
    console.error('Dashboard analytics error:', err);
    res.status(500).json({ detail: 'Failed to fetch analytics' });
  }
});

router.get('/analytics/daily', async (req, res) => {
  try {
    const { start, end } = req.query;
    let sql = 'SELECT date, SUM(amount) as revenue, SUM(profit) as profit, COUNT(*) as orders FROM orders WHERE user_id = $1';
    const params = [req.user.user_id];
    if (start && end) {
      sql += ' AND date BETWEEN $2 AND $3';
      params.push(start, end);
    }
    sql += ' GROUP BY date ORDER BY date';
    const results = await queryAll(sql, params);
    res.json(results);
  } catch (err) {
    console.error('Daily analytics error:', err);
    res.status(500).json({ detail: 'Failed to fetch daily analytics' });
  }
});

router.get('/analytics/monthly', async (req, res) => {
  try {
    const results = await queryAll(`
      SELECT TO_CHAR(date, 'YYYY-MM') as month, SUM(amount) as revenue, SUM(profit) as profit, COUNT(*) as orders
      FROM orders WHERE user_id = $1 AND status NOT IN ('cancelled', 'returned')
      GROUP BY month ORDER BY month`, [req.user.user_id]);
    res.json(results);
  } catch (err) {
    console.error('Monthly analytics error:', err);
    res.status(500).json({ detail: 'Failed to fetch monthly analytics' });
  }
});

router.get('/analytics/top-customers', async (req, res) => {
  try {
    const { limit } = req.query;
    const results = await queryAll(`
      SELECT customer_name, customer_phone, COUNT(*) as orders, SUM(amount) as total_spent, SUM(profit) as total_profit
      FROM orders WHERE user_id = $1 AND status NOT IN ('cancelled', 'returned') AND customer_name IS NOT NULL
      GROUP BY customer_name, customer_phone ORDER BY total_spent DESC LIMIT $2`,
      [req.user.user_id, limit || 10]);
    res.json(results);
  } catch (err) {
    console.error('Top customers error:', err);
    res.status(500).json({ detail: 'Failed to fetch top customers' });
  }
});

router.get('/analytics/investments-by-category', async (req, res) => {
  try {
    const results = await queryAll(`
      SELECT category, SUM(amount) as total FROM investments WHERE user_id = $1 GROUP BY category ORDER BY total DESC`,
      [req.user.user_id]);
    res.json(results);
  } catch (err) {
    console.error('Investments by category error:', err);
    res.status(500).json({ detail: 'Failed to fetch investments by category' });
  }
});

router.get('/analytics/forecast', async (req, res) => {
  try {
    const recentOrders = await queryAll(`
      SELECT date, SUM(amount) as revenue FROM orders WHERE user_id = $1 AND status NOT IN ('cancelled', 'returned')
      GROUP BY date ORDER BY date DESC LIMIT 30`, [req.user.user_id]);

    const last7Days = recentOrders.slice(0, 7);
    const avgRevenue = last7Days.length > 0 ? last7Days.reduce((a, b) => a + parseFloat(b.revenue || 0), 0) / 7 : 0;
    const growthRate = recentOrders.length >= 14
      ? (recentOrders.slice(0, 7).reduce((a, b) => a + parseFloat(b.revenue || 0), 0) - recentOrders.slice(7, 14).reduce((a, b) => a + parseFloat(b.revenue || 0), 0)) / 7
      : 0;

    res.json({
      predicted_next_week_revenue: avgRevenue * 7,
      predicted_next_month_revenue: avgRevenue * 30,
      growth_rate: growthRate,
      daily_avg: avgRevenue,
      confidence: 'medium'
    });
  } catch (err) {
    console.error('Forecast error:', err);
    res.status(500).json({ detail: 'Failed to generate forecast' });
  }
});

router.get('/analytics/monthly-report', async (req, res) => {
  try {
    const { month } = req.query;
    const startOfMonth = month + '-01';
    const endOfMonth = month + '-31';

    const summary = await queryOne(`
      SELECT COALESCE(SUM(amount), 0) as revenue, COALESCE(SUM(profit), 0) as profit, COUNT(*) as orders
      FROM orders WHERE user_id = $1 AND date >= $2 AND date <= $3 AND status NOT IN ('cancelled', 'returned')`,
      [req.user.user_id, startOfMonth, endOfMonth]);

    const investments = await queryOne(`
      SELECT COALESCE(SUM(amount), 0) as total FROM investments WHERE user_id = $1 AND date >= $2 AND date <= $3`,
      [req.user.user_id, startOfMonth, endOfMonth]);

    res.json({
      ...summary,
      investments: investments?.total || 0,
      net_profit: parseFloat(summary?.profit || 0) - parseFloat(investments?.total || 0)
    });
  } catch (err) {
    console.error('Monthly report error:', err);
    res.status(500).json({ detail: 'Failed to generate monthly report' });
  }
});

router.get('/analytics/pl-statement', async (req, res) => {
  try {
    const { month } = req.query;
    const startOfMonth = month + '-01';
    const endOfMonth = month + '-31';

    const revenue = await queryOne(`
      SELECT COALESCE(SUM(amount), 0) as total FROM orders WHERE user_id = $1 AND date >= $2 AND date <= $3 AND status NOT IN ('cancelled', 'returned')`,
      [req.user.user_id, startOfMonth, endOfMonth]);

    const productCosts = await queryOne(`
      SELECT COALESCE(SUM(product_cost), 0) as total FROM orders WHERE user_id = $1 AND date >= $2 AND date <= $3`,
      [req.user.user_id, startOfMonth, endOfMonth]);

    const investments = await queryOne(`
      SELECT COALESCE(SUM(amount), 0) as total FROM investments WHERE user_id = $1 AND date >= $2 AND date <= $3`,
      [req.user.user_id, startOfMonth, endOfMonth]);

    const grossProfit = parseFloat(revenue?.total || 0) - parseFloat(productCosts?.total || 0);
    const netProfit = grossProfit - parseFloat(investments?.total || 0);

    res.json({
      revenue: parseFloat(revenue?.total || 0),
      cost_of_goods_sold: parseFloat(productCosts?.total || 0),
      gross_profit: grossProfit,
      operating_expenses: parseFloat(investments?.total || 0),
      net_profit: netProfit,
      profit_margin: revenue?.total > 0 ? (netProfit / revenue.total * 100).toFixed(2) : 0
    });
  } catch (err) {
    console.error('P&L statement error:', err);
    res.status(500).json({ detail: 'Failed to generate P&L statement' });
  }
});

router.get('/analytics/pricing-recommendations', async (req, res) => {
  try {
    const products = await queryAll(`
      SELECT name, category, unit_cost, sell_price, current_stock, SUM(quantity) as total_sold
      FROM products p LEFT JOIN orders o ON p.id = o.product_id AND o.user_id = $1
      WHERE p.user_id = $1 GROUP BY p.id`, [req.user.user_id]);

    const recommendations = products.map(p => {
      const cost = parseFloat(p.unit_cost || 0);
      const price = parseFloat(p.sell_price || 0);
      const margin = price > 0 ? ((price - cost) / price * 100) : 0;
      const stock = parseInt(p.current_stock || 0);
      const sold = parseInt(p.total_sold || 0);

      let recommendation = { product: p.name, current_price: price, current_margin: margin.toFixed(2) };

      if (stock > 100 && sold < 10) {
        recommendation = { ...recommendation, action: 'Consider reducing price', suggested_price: (price * 0.9).toFixed(2) };
      } else if (margin < 20) {
        recommendation = { ...recommendation, action: 'Increase price slightly', suggested_price: (price * 1.15).toFixed(2) };
      } else if (margin > 60) {
        recommendation = { ...recommendation, action: 'Room for competitive pricing', suggested_price: (price * 0.9).toFixed(2) };
      } else {
        recommendation = { ...recommendation, action: 'Price is optimal', suggested_price: price };
      }
      return recommendation;
    });

    res.json(recommendations);
  } catch (err) {
    console.error('Pricing recommendations error:', err);
    res.status(500).json({ detail: 'Failed to generate pricing recommendations' });
  }
});

router.get('/analytics/restock-plan', async (req, res) => {
  try {
    const { horizon_days } = req.query;
    const horizon = horizon_days || 14;

    const products = await queryAll(`
      SELECT p.id, p.name, p.current_stock, p.reorder_level, p.sell_price,
             COALESCE(SUM(o.quantity), 0) as avg_daily_sold
      FROM products p LEFT JOIN orders o ON p.id = o.product_id AND o.date >= NOW() - INTERVAL '30 days'
      WHERE p.user_id = $1 GROUP BY p.id`,
      [req.user.user_id]);

    const plan = products.filter(p => {
      const stock = parseInt(p.current_stock || 0);
      const avgSold = parseInt(p.avg_daily_sold || 0);
      const daysOfStock = avgSold > 0 ? stock / avgSold : 999;
      return stock <= p.reorder_level || daysOfStock < parseInt(horizon);
    }).map(p => ({
      product_id: p.id,
      product: p.name,
      current_stock: p.current_stock,
      reorder_level: p.reorder_level,
      avg_daily_sales: Math.round(p.avg_daily_sold / 30 * 10) / 10 || 0,
      days_until_stockout: Math.round((p.current_stock || 0) / (p.avg_daily_sold / 30 || 1)),
      suggested_restock_quantity: Math.max(p.reorder_level * 2 - (p.current_stock || 0), 10),
      estimated_revenue_impact: ((p.sell_price || 0) * Math.max(p.reorder_level * 2 - (p.current_stock || 0), 10)).toFixed(2)
    }));

    res.json(plan);
  } catch (err) {
    console.error('Restock plan error:', err);
    res.status(500).json({ detail: 'Failed to generate restock plan' });
  }
});

router.get('/analytics/compare', async (req, res) => {
  try {
    const { p1_start, p1_end, p2_start, p2_end } = req.query;

    const period1 = await queryOne(`
      SELECT COALESCE(SUM(amount), 0) as revenue, COALESCE(SUM(profit), 0) as profit, COUNT(*) as orders
      FROM orders WHERE user_id = $1 AND date >= $2 AND date <= $3 AND status NOT IN ('cancelled', 'returned')`,
      [req.user.user_id, p1_start, p1_end]);

    const period2 = await queryOne(`
      SELECT COALESCE(SUM(amount), 0) as revenue, COALESCE(SUM(profit), 0) as profit, COUNT(*) as orders
      FROM orders WHERE user_id = $1 AND date >= $2 AND date <= $3 AND status NOT IN ('cancelled', 'returned')`,
      [req.user.user_id, p2_start, p2_end]);

    const p1Rev = parseFloat(period1?.revenue || 0);
    const p2Rev = parseFloat(period2?.revenue || 0);
    const revChange = p1Rev > 0 ? ((p1Rev - p2Rev) / p2Rev * 100).toFixed(2) : 0;

    res.json({
      period1: { ...period1, revenue: p1Rev, profit: parseFloat(period1?.profit || 0) },
      period2: { ...period2, revenue: p2Rev, profit: parseFloat(period2?.profit || 0) },
      revenue_change_percent: revChange
    });
  } catch (err) {
    console.error('Compare error:', err);
    res.status(500).json({ detail: 'Failed to compare periods' });
  }
});



router.get('/customers', async (req, res) => {
  try {
    const customers = await queryAll(`
      SELECT DISTINCT ON (customer_name) customer_name, customer_phone, MAX(date) as last_order,
             COUNT(*) as total_orders, SUM(amount) as total_spent
      FROM orders WHERE user_id = $1 AND status NOT IN ('cancelled', 'returned')
      GROUP BY customer_name, customer_phone ORDER BY customer_name`,
      [req.user.user_id]);
    res.json(customers);
  } catch (err) {
    console.error('Get customers error:', err);
    res.status(500).json({ detail: 'Failed to fetch customers' });
  }
});

router.get('/customers/at-risk', async (req, res) => {
  try {
    const { inactive_days } = req.query;
    const days = inactive_days || 30;
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

    const atRisk = await queryAll(`
      SELECT customer_name, customer_phone, MAX(date) as last_order_date,
             COUNT(*) as order_count, SUM(amount) as total_spent
      FROM orders WHERE user_id = $1 AND date < $2 AND status NOT IN ('cancelled', 'returned')
      GROUP BY customer_name, customer_phone ORDER BY last_order_date ASC`,
      [req.user.user_id, cutoff]);
    res.json(atRisk);
  } catch (err) {
    console.error('At-risk customers error:', err);
    res.status(500).json({ detail: 'Failed to fetch at-risk customers' });
  }
});

router.post('/customers/win-back/preview', async (req, res) => {
  try {
    const { customer_names, discount_percent } = req.body;
    res.json({
      preview: customer_names?.map(name => ({
        customer: name,
        suggested_message: `Hi ${name}, we miss you! Get ${discount_percent || 10}% off your next order!`,
        estimated_cost: 50
      })) || [],
      total_cost: 50 * (customer_names?.length || 0)
    });
  } catch (err) {
    console.error('Win-back preview error:', err);
    res.status(500).json({ detail: 'Failed to generate win-back preview' });
  }
});



router.get('/staff', async (req, res) => {
  try {
    const staff = await queryAll(`
      SELECT id, email, business_name as name, role, is_active, created_at
      FROM users WHERE parent_id = $1`, [req.user.user_id]);
    res.json(staff);
  } catch (err) {
    console.error('Get staff error:', err);
    res.status(500).json({ detail: 'Failed to fetch staff' });
  }
});

router.post('/staff', async (req, res) => {
  try {
    const { email, password, business_name, role } = req.body;
    const bcrypt = require('bcryptjs');
    const hashed = await bcrypt.hash(password || 'temp1234', 10);
    const user = await queryOne(
      `INSERT INTO users (email, hashed_password, business_name, role, parent_id, is_active)
       VALUES ($1, $2, $3, $4, $5, true) RETURNING id, email, business_name, role`,
      [email, hashed, business_name, role || 'staff', req.user.user_id]
    );
    res.status(201).json(user);
  } catch (err) {
    if (err.code === '23505') res.status(409).json({ detail: 'Email already exists' });
    else { console.error('Create staff error:', err); res.status(500).json({ detail: 'Failed to create staff' }); }
  }
});

router.delete('/staff/:id', async (req, res) => {
  try {
    await query('DELETE FROM users WHERE id = $1 AND parent_id = $2', [req.params.id, req.user.user_id]);
    res.json({ detail: 'Staff deleted' });
  } catch (err) {
    console.error('Delete staff error:', err);
    res.status(500).json({ detail: 'Failed to delete staff' });
  }
});



router.get('/settings', async (req, res) => {
  try {
    const settings = await queryOne('SELECT * FROM user_settings WHERE user_id = $1', [req.user.user_id]);
    res.json(settings || { user_id: req.user.user_id });
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ detail: 'Failed to fetch settings' });
  }
});

router.put('/settings', async (req, res) => {
  try {
    const { delivery_cost, notification_email, google_sheet_id, gemini_api_key, report_time } = req.body;
    await query(`
      INSERT INTO user_settings (user_id, delivery_cost, notification_email, google_sheet_id, gemini_api_key, report_time)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id) DO UPDATE SET
        delivery_cost = COALESCE($2, user_settings.delivery_cost),
        notification_email = COALESCE($3, user_settings.notification_email),
        google_sheet_id = COALESCE($4, user_settings.google_sheet_id),
        gemini_api_key = COALESCE($5, user_settings.gemini_api_key),
        report_time = COALESCE($6, user_settings.report_time)
      RETURNING *`,
      [req.user.user_id, delivery_cost, notification_email, google_sheet_id, gemini_api_key, report_time]);
    res.json({ detail: 'Settings updated' });
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ detail: 'Failed to update settings' });
  }
});



router.get('/audit-log', async (req, res) => {
  try {
    const { entity, action, search, start_date, end_date, page, limit } = req.query;
    let sql = `SELECT * FROM audit_logs WHERE owner_id = $1`;
    const params = [req.user.user_id];
    let pIdx = 2;

    if (entity) { sql += ` AND entity = $${pIdx}`; params.push(entity); pIdx++; }
    if (action) { sql += ` AND action = $${pIdx}`; params.push(action); pIdx++; }
    if (search) { sql += ` AND (summary ILIKE $${pIdx} OR details ILIKE $${pIdx})`; params.push(`%${search}%`); pIdx++; }
    if (start_date) { sql += ` AND created_at >= $${pIdx}`; params.push(start_date); pIdx++; }
    if (end_date) { sql += ` AND created_at <= $${pIdx}`; params.push(end_date); pIdx++; }

    sql += ' ORDER BY created_at DESC';
    const offset = ((parseInt(page) || 1) - 1) * (parseInt(limit) || 50);
    sql += ` LIMIT $${pIdx} OFFSET $${pIdx + 1}`;
    params.push(parseInt(limit) || 50, offset);

    const logs = await queryAll(sql, params);
    res.json(logs);
  } catch (err) {
    console.error('Audit log error:', err);
    res.status(500).json({ detail: 'Failed to fetch audit log' });
  }
});



router.post('/ai/insights', async (req, res) => {
  try {
    const aiService = require('../../../ai_service/gemini');
    const orders = await queryAll('SELECT * FROM orders WHERE user_id = $1 AND status NOT IN (\'cancelled\', \'returned\') ORDER BY date', [req.user.user_id]);
    const products = await queryAll('SELECT * FROM products WHERE user_id = $1', [req.user.user_id]);
    const insights = await aiService.generateInsights(orders, products, req.user.user_id);
    res.json(insights);
  } catch (err) {
    console.error('AI insights error:', err);
    res.status(500).json({ detail: 'Failed to generate AI insights' });
  }
});

router.post('/ai/query', async (req, res) => {
  try {
    const { question } = req.body;
    const aiService = require('../../../ai_service/gemini');
    const orders = await queryAll('SELECT * FROM orders WHERE user_id = $1 AND status NOT IN (\'cancelled\', \'returned\') ORDER BY date', [req.user.user_id]);
    const products = await queryAll('SELECT * FROM products WHERE user_id = $1', [req.user.user_id]);
    const result = await aiService.query(orders, products, question, req.user.user_id);
    res.json(result);
  } catch (err) {
    console.error('AI query error:', err);
    res.status(500).json({ detail: 'Failed to process AI query' });
  }
});



router.post('/sheets/connect', async (req, res) => {
  try {
    await query(`INSERT INTO user_settings (user_id, google_sheet_id) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET google_sheet_id = EXCLUDED.google_sheet_id`,
      [req.user.user_id, req.body.sheet_id]);
    res.json({ detail: 'Google Sheets connected' });
  } catch (err) {
    console.error('Sheets connect error:', err);
    res.status(500).json({ detail: 'Failed to connect Google Sheets' });
  }
});

router.post('/sheets/sync', async (req, res) => {
  try { res.json({ detail: 'Sync completed', synced: 0 }); }
  catch (err) { res.status(500).json({ detail: 'Sync failed' }); }
});

router.post('/sheets/import', async (req, res) => {
  try { res.json({ detail: 'Import completed', imported: 0 }); }
  catch (err) { res.status(500).json({ detail: 'Import failed' }); }
});



router.get('/admin/shops', async (req, res) => {
  try {
    const shops = await queryAll(`SELECT id, email, business_name, role, created_at FROM users WHERE id != $1`, [req.user.user_id]);
    res.json(shops);
  } catch (err) {
    console.error('Admin shops error:', err);
    res.status(500).json({ detail: 'Failed to fetch shops' });
  }
});

router.delete('/admin/shops/:id', async (req, res) => {
  try {
    await query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ detail: 'Shop deleted' });
  } catch (err) {
    console.error('Delete shop error:', err);
    res.status(500).json({ detail: 'Failed to delete shop' });
  }
});

module.exports = router;