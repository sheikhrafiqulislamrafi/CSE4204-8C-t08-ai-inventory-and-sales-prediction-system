/**
 * Analytics Routes - Full Python FastAPI Implementation
 */

const express = require('express');
const router = express.Router();
const { query, queryOne, queryAll } = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');
const { requireOwner } = require('../middleware/authMiddleware');
const {
  roundMoney: _roundMoney,
  round1: _round1,
  orderSign: _orderSign,
  isCancelledStatus,
  customerAggregates,
  dailyAggregates,
  daysAgoString,
  todayString
} = require('../utils/helpers');

router.use(authMiddleware);

const requireOwnerAnalytics = (req, res, next) => requireOwner(req, res, next);

// Helper functions
function getDashboardSummary(orders, investments) {
  const cancelledReturned = orders.filter(o => isCancelledStatus(o.status));

  const totalRevenue = orders.reduce((sum, o) => sum + _orderSign(o.status) * ((parseFloat(o.amount) || 0) + (parseFloat(o.delivery_cost) || 0)), 0);
  const totalDelivery = orders.reduce((sum, o) => sum + _orderSign(o.status) * (parseFloat(o.delivery_cost) || 0), 0);
  const grossProfit = orders.reduce((sum, o) => sum + _orderSign(o.status) * ((parseFloat(o.amount) || 0) - (parseFloat(o.product_cost) || 0)), 0);
  const totalInvestment = investments.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);
  const totalOrders = orders.length;
  const cancelledReturnedCount = cancelledReturned.length;
  const cancelledReturnedAmount = cancelledReturned.reduce((sum, o) => sum + (parseFloat(o.amount) || 0) + (parseFloat(o.delivery_cost) || 0), 0);

  const dates = orders.map(o => o.date).filter(Boolean);

  return {
    total_revenue: _roundMoney(totalRevenue),
    total_orders: totalOrders,
    gross_profit: _roundMoney(grossProfit),
    total_profit: _roundMoney(grossProfit),
    net_cash_flow: _roundMoney(grossProfit - totalInvestment),
    total_investment: _roundMoney(totalInvestment),
    gross_margin: totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 100 * 10) / 10 : 0,
    profit_margin: totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 100 * 10) / 10 : 0,
    avg_order_value: totalOrders > 0 ? _roundMoney(totalRevenue / totalOrders) : 0,
    total_delivery_cost: _roundMoney(totalDelivery),
    total_customers: new Set(orders.map(o => o.customer_phone).filter(Boolean)).size,
    investment_count: investments.length,
    investment_entries: investments.length,
    last_sale_date: dates.length > 0 ? Math.max(...dates.map(d => new Date(d).getTime())) : null,
    last_order_date: dates.length > 0 ? Math.max(...dates.map(d => new Date(d).getTime())) : null,
    highest_order_value: orders.length > 0 ? _roundMoney(Math.max(...orders.map(o => parseFloat(o.amount) || 0))) : 0,
    cancelled_returned_count: cancelledReturnedCount,
    cancelled_returned_amount: _roundMoney(cancelledReturnedAmount),
    recent_7_day_revenue: 0, // Will be calculated if needed
    recent_7_day_profit: 0
  };
}

// /analytics/summary - Comprehensive metrics
router.get('/summary', async (req, res) => {
  try {
    const userId = req.businessOwnerId;
    const orders = await queryAll('SELECT * FROM orders WHERE user_id = $1', [userId]);
    const investments = req.user.role === 'owner'
      ? await queryAll('SELECT * FROM investments WHERE user_id = $1', [userId])
      : [];

    const summary = getDashboardSummary(orders, investments);

    // Calculate 7-day metrics
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const cutoffStr = sevenDaysAgo.toISOString().split('T')[0];

    const recentOrders = orders.filter(o => o.date >= cutoffStr);
    const recentRevenue = recentOrders.reduce((sum, o) => sum + _orderSign(o.status) * (parseFloat(o.amount) || 0), 0);
    const recentProfit = recentOrders.reduce((sum, o) => sum + _orderSign(o.status) * (parseFloat(o.profit) || 0), 0);

    summary.recent_7_day_revenue = _roundMoney(recentRevenue);
    summary.recent_7_day_profit = _roundMoney(recentProfit);

    // Daily aggregates
    const daily = {};
    for (const o of orders) {
      if (!o.date) continue;
      if (!daily[o.date]) daily[o.date] = { orders: 0, revenue: 0, delivery_cost: 0, profit: 0 };
      daily[o.date].orders++;
      daily[o.date].revenue += _orderSign(o.status) * ((parseFloat(o.amount) || 0) + (parseFloat(o.delivery_cost) || 0));
      daily[o.date].delivery_cost += _orderSign(o.status) * (parseFloat(o.delivery_cost) || 0);
      daily[o.date].profit += _orderSign(o.status) * (parseFloat(o.profit) || 0);
    }

    const dailyAggregates = Object.entries(daily).map(([date, v]) => ({
      date,
      orders: v.orders,
      revenue: _roundMoney(v.revenue),
      delivery_cost: _roundMoney(v.delivery_cost),
      profit: _roundMoney(v.profit),
      average_order: v.orders > 0 ? _roundMoney(v.revenue / v.orders) : 0
    })).sort((a, b) => a.date.localeCompare(b.date));

    // Top products
    const productStats = {};
    for (const o of orders) {
      if (!o.product_name) continue;
      if (!productStats[o.product_name]) productStats[o.product_name] = { product_name: o.product_name, total_quantity: 0, total_amount: 0 };
      productStats[o.product_name].total_quantity += parseInt(o.quantity || 1);
      productStats[o.product_name].total_amount += _orderSign(o.status) * (parseFloat(o.amount) || 0);
    }
    const topProducts = Object.values(productStats)
      .sort((a, b) => b.total_amount - a.total_amount)
      .slice(0, 10)
      .map(p => ({ ...p, total_amount: _roundMoney(p.total_amount) }));

    res.json({
      ...summary,
      daily_aggregates: dailyAggregates,
      top_products: topProducts
    });
  } catch (err) {
    console.error('Analytics summary error:', err);
    res.status(500).json({ detail: 'Failed to fetch analytics summary' });
  }
});

// /analytics/daily
router.get('/daily', requireOwnerAnalytics, async (req, res) => {
  try {
    const userId = req.businessOwnerId;
    const { start, end } = req.query;
    let sql = 'SELECT date, SUM(amount) as revenue, SUM(profit) as profit, COUNT(*) as orders FROM orders WHERE user_id = $1';
    const params = [userId];
    let idx = 2;
    if (start) { sql += ` AND date >= $${idx}`; params.push(start); idx++; }
    if (end) { sql += ` AND date <= $${idx}`; params.push(end); idx++; }
    sql += ' GROUP BY date ORDER BY date';
    const results = await queryAll(sql, params);

    res.json(results.map(r => ({
      date: r.date,
      orders: parseInt(r.orders || 0),
      revenue: _roundMoney(r.revenue || 0),
      profit: _roundMoney(r.profit || 0),
      average_order: r.orders > 0 ? _roundMoney((r.revenue || 0) / r.orders) : 0
    })));
  } catch (err) {
    console.error('Daily analytics error:', err);
    res.status(500).json({ detail: 'Failed to fetch daily analytics' });
  }
});

// /analytics/monthly
router.get('/monthly', async (req, res) => {
  try {
    const userId = req.businessOwnerId;
    const results = await queryAll(`
      SELECT LEFT(date, 7) as month,
             SUM(amount) as revenue,
             SUM(profit) as gross_profit,
             SUM(delivery_cost) as delivery_cost,
             COUNT(*) as orders
      FROM orders
      WHERE user_id = $1 AND date IS NOT NULL AND LENGTH(date) >= 7
      GROUP BY LEFT(date, 7)
      ORDER BY month`, [userId]);
    res.json(results.map(r => ({
      month: r.month,
      orders: parseInt(r.orders || 0),
      revenue: _roundMoney(r.revenue || 0),
      gross_profit: _roundMoney(r.gross_profit || 0),
      delivery_cost: _roundMoney(r.delivery_cost || 0),
      net_cash_flow: _roundMoney((r.gross_profit || 0) - (r.delivery_cost || 0)),
      gross_margin: (r.revenue || 0) > 0 ? Math.round((r.gross_profit / r.revenue) * 100 * 10) / 10 : 0
    })));
  } catch (err) {
    console.error('Monthly analytics error:', err);
    res.status(500).json({ detail: 'Failed to fetch monthly analytics' });
  }
});

// /analytics/top-customers
router.get('/top-customers', async (req, res) => {
  try {
    const userId = req.businessOwnerId;
    const limit = parseInt(req.query.limit || 10);
    const results = await queryAll(`
      SELECT MAX(NULLIF(BTRIM(customer_name), '')) as customer_name,
             customer_phone,
             COUNT(*) as total_orders,
             SUM(amount) as total_revenue,
             SUM(profit) as total_profit
      FROM orders WHERE user_id = $1 AND customer_phone IS NOT NULL
      GROUP BY customer_phone
      ORDER BY total_revenue DESC LIMIT $2`, [userId, limit]);

    res.json(results.map(c => ({
      ...c,
      name: c.customer_name || c.customer_phone || 'Unknown',
      orders: parseInt(c.total_orders),
      spent: _roundMoney(c.total_revenue || 0),
      total_profit: _roundMoney(c.total_profit || 0)
    })));
  } catch (err) {
    console.error('Top customers error:', err);
    res.status(500).json({ detail: 'Failed to fetch top customers' });
  }
});

// /analytics/investments-by-category
router.get('/investments-by-category', requireOwnerAnalytics, async (req, res) => {
  try {
    const userId = req.businessOwnerId;
    const results = await queryAll(`
      SELECT category, SUM(amount) as total, COUNT(*) as entries
      FROM investments WHERE user_id = $1 GROUP BY category ORDER BY total DESC`, [userId]);
    res.json(results.map(r => ({
      category: r.category,
      amount: _roundMoney(r.total || 0),
      entries: parseInt(r.entries || 0)
    })));
  } catch (err) {
    console.error('Investments by category error:', err);
    res.status(500).json({ detail: 'Failed to fetch investments' });
  }
});

// /analytics/pricing-recommendations - AI powered
router.get('/pricing-recommendations', requireOwnerAnalytics, async (req, res) => {
  try {
    const userId = req.businessOwnerId;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffStr = thirtyDaysAgo.toISOString().split('T')[0];

    // Fetch sales velocities using product_name/text matching since orders.product_id is text
    const salesData = await queryAll(`
      SELECT p.id as product_id, p.sku, p.name as product_name,
             SUM(o.quantity) as units_sold
      FROM orders o
      JOIN products p ON (o.product_id::text = p.sku::text OR o.product_name = p.name)
      WHERE o.user_id = $1
        AND o.status = 'delivered'
        AND o.date >= $2
      GROUP BY p.id, p.sku, p.name`, [userId, cutoffStr]);

    const products = await queryAll('SELECT * FROM products WHERE user_id = $1', [userId]);
    const recommendations = [];

    // Build velocity maps
    const velocityBySku = {};
    const velocityByName = {};
    for (const s of salesData) {
      if (s.product_id) velocityBySku[s.product_id.toString()] = parseInt(s.units_sold || 0);
      if (s.product_name) velocityByName[s.product_name.toLowerCase()] = parseInt(s.units_sold || 0);
    }

    for (const p of products) {
      let unitsSold = 0;
      if (velocityBySku[p.id.toString()]) unitsSold = velocityBySku[p.id.toString()];
      else if (p.name && velocityByName[p.name.toLowerCase()]) unitsSold = velocityByName[p.name.toLowerCase()];

      const currentPrice = parseFloat(p.sell_price || 0);
      const cost = parseFloat(p.unit_cost || 0);
      const stock = parseInt(p.current_stock || 0);

      if (currentPrice > 0) {
        let action = 'none';
        let suggestedPrice = currentPrice;
        let reason = '';

        if (unitsSold > 10 && stock < 10) {
          action = 'increase';
          suggestedPrice = Math.round(currentPrice * (1 + (Math.random() * 0.05 + 0.05)) * 100) / 100;
          reason = 'High demand with low stock. Price increase recommended to maximize margin before stockout.';
        } else if (unitsSold <= 5 && stock > 50) {
          action = 'decrease';
          const newPrice = Math.round(currentPrice * (1 - (Math.random() * 0.1 + 0.1)) * 100) / 100;
          suggestedPrice = Math.max(newPrice, cost * 1.05); // At least 5% margin
          reason = 'Dead stock with high buffer. Price decrease recommended to liquidate capital.';
        }

        if (action !== 'none') {
          recommendations.push({
            product_id: p.id,
            sku: p.sku || null,
            name: p.name,
            current_price: currentPrice,
            unit_cost: cost,
            suggested_price: suggestedPrice,
            action: action,
            reason: reason
          });
        }
      }
    }

    // Sort by urgency (high demand/low stock first)
    recommendations.sort((a, b) => {
      const urgencyA = a.action === 'increase' ? 0 : 1;
      const urgencyB = b.action === 'increase' ? 0 : 1;
      return urgencyA - urgencyB;
    });

    res.json(recommendations);
  } catch (err) {
    console.error('Pricing recommendations error:', err);
    res.status(500).json({ detail: 'Failed to generate pricing recommendations', error: err.message });
  }
});

// /analytics/forecast
router.get('/forecast', requireOwnerAnalytics, async (req, res) => {
  try {
    const userId = req.businessOwnerId;
    const cutoff90 = new Date();
    cutoff90.setDate(cutoff90.getDate() - 90);
    const cutoffStr = cutoff90.toISOString().split('T')[0];

    const orders = await queryAll(`
      SELECT date, amount, quantity, product_name, status FROM orders
      WHERE user_id = $1 AND date >= $2 AND status NOT IN ('cancelled', 'returned')
      ORDER BY date ASC`, [userId, cutoffStr]);

    if (orders.length === 0) {
      return res.json({
        daily_forecast: [],
        top_products_forecast: [],
        insights: 'Not enough data for a forecast.'
      });
    }

    // Calculate daily revenue
    const dailyData = {};
    for (const o of orders) {
      if (!o.date) continue;
      if (!dailyData[o.date]) dailyData[o.date] = { revenue: 0, orders: 0 };
      dailyData[o.date].revenue += parseFloat(o.amount || 0);
      dailyData[o.date].orders += 1;
    }

    // Build forecast using 7-day moving average
    const dates = Object.keys(dailyData).sort();
    const dailyForecast = [];
    const endDate = new Date();

    // Calculate 7-day rolling averages
    const revenues = dates.map(d => dailyData[d].revenue);
    const ordersCounts = dates.map(d => dailyData[d].orders);

    let sumRev = 0, sumOrd = 0;
    for (let i = 0; i < revenues.length; i++) {
      sumRev += revenues[i];
      sumOrd += ordersCounts[i];
      if (i >= 6) {
        sumRev -= revenues[i - 7];
        sumOrd -= ordersCounts[i - 7];
      }
      const avgRev = sumRev / Math.min(7, i + 1);
      const avgOrd = Math.round(sumOrd / Math.min(7, i + 1));
    }

    // Forecast next 14 days
    const lastAvgRev = revenues.length > 0 ? revenues.slice(-7).reduce((a, b) => a + b, 0) / Math.min(7, revenues.length) : 0;
    const lastAvgOrd = revenues.length > 0 ? ordersCounts.slice(-7).reduce((a, b) => a + b, 0) / Math.min(7, ordersCounts.length) : 0;

    for (let i = 1; i <= 14; i++) {
      const d = new Date(endDate);
      d.setDate(d.getDate() + i);
      dailyForecast.push({
        date: d.toISOString().split('T')[0],
        predicted_revenue: Math.round(lastAvgRev * 100) / 100,
        predicted_orders: Math.max(1, Math.round(lastAvgOrd))
      });
    }

    // Product forecast
    const cutoff30 = new Date();
    cutoff30.setDate(cutoff30.getDate() - 30);
    const cutoff30Str = cutoff30.toISOString().split('T')[0];

    const productStats = {};
    for (const o of orders) {
      if (o.date >= cutoff30Str && o.product_name) {
        if (!productStats[o.product_name]) productStats[o.product_name] = { units_30d: 0 };
        productStats[o.product_name].units_30d += parseInt(o.quantity || 1);
      }
    }

    const topProductsForecast = Object.entries(productStats)
      .sort((a, b) => b[1].units_30d - a[1].units_30d)
      .slice(0, 10)
      .map(([name, stats]) => ({
        product_name: name,
        predicted_demand_14d: Math.max(1, Math.round(stats.units_30d * (14 / 30)))
      }));

    res.json({
      daily_forecast: dailyForecast,
      top_products_forecast: topProductsForecast,
      insights: 'Forecast based on 90-day historical data with 7-day moving average.'
    });
  } catch (err) {
    console.error('Forecast error:', err);
    res.status(500).json({ detail: 'Failed to generate forecast' });
  }
});

// /analytics/monthly-report
router.get('/monthly-report', requireOwnerAnalytics, async (req, res) => {
  try {
    const userId = req.businessOwnerId;
    const { month } = req.query;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ detail: 'Month parameter required in YYYY-MM format' });
    }

    const y = parseInt(month.split('-')[0]);
    const m = parseInt(month.split('-')[1]);
    const startDate = `${month}-01`;
    const endMonth = m === 12 ? 1 : m + 1;
    const endYear = m === 12 ? y + 1 : y;
    const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

    const orders = await queryAll(
      'SELECT * FROM orders WHERE user_id = $1 AND date >= $2 AND date < $3',
      [userId, startDate, endDate]
    );
    const investments = await queryAll(
      'SELECT * FROM investments WHERE user_id = $1 AND date >= $2 AND date < $3',
      [userId, startDate, endDate]
    );

    const totalRevenue = orders.reduce((sum, o) => sum + _orderSign(o.status) * (parseFloat(o.amount) || 0), 0);
    const totalOrders = orders.length;
    const totalInvestment = investments.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);
    const netProfit = totalRevenue - totalInvestment;

    // Daily breakdown
    const dailyMap = {};
    for (const o of orders) {
      if (!o.date) continue;
      if (!dailyMap[o.date]) dailyMap[o.date] = 0;
      dailyMap[o.date] += _orderSign(o.status) * (parseFloat(o.amount) || 0);
    }
    const dailyRevenue = Object.entries(dailyMap)
      .map(([date, revenue]) => ({ date, revenue: _roundMoney(revenue) }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Top products
    const prodMap = {};
    for (const o of orders) {
      const sign = _orderSign(o.status);
      const name = o.product_name || 'Unknown';
      if (!prodMap[name]) prodMap[name] = { qty: 0, revenue: 0 };
      prodMap[name].qty += sign * (parseInt(o.quantity || 1));
      prodMap[name].revenue += sign * (parseFloat(o.amount) || 0);
    }
    const topProducts = Object.entries(prodMap)
      .map(([name, v]) => ({ name, qty: v.qty, revenue: _roundMoney(v.revenue) }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    res.json({
      month,
      total_revenue: _roundMoney(totalRevenue),
      total_orders: totalOrders,
      total_investment: _roundMoney(totalInvestment),
      net_profit: _roundMoney(netProfit),
      daily_revenue: dailyRevenue,
      top_products: topProducts
    });
  } catch (err) {
    console.error('Monthly report error:', err);
    res.status(500).json({ detail: 'Failed to generate monthly report' });
  }
});

// /analytics/restock-plan - Based on 30-day sales velocity
router.get('/restock-plan', requireOwnerAnalytics, async (req, res) => {
  try {
    const userId = req.businessOwnerId;
    const horizonDays = parseInt(req.query.horizon_days || 14);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffStr = thirtyDaysAgo.toISOString().split('T')[0];

    const salesData = await queryAll(`
      SELECT product_id, product_name, SUM(quantity) as units_sold
      FROM orders WHERE user_id = $1
        AND status = 'delivered'
        AND date >= $2
      GROUP BY product_id, product_name`, [userId, cutoffStr]);

    const velocityBySku = {};
    const velocityByName = {};
    for (const s of salesData) {
      if (s.product_id) velocityBySku[s.product_id.toString()] = parseInt(s.units_sold || 0);
      if (s.product_name) velocityByName[s.product_name.toLowerCase()] = parseInt(s.units_sold || 0);
    }

    const products = await queryAll('SELECT * FROM products WHERE user_id = $1', [userId]);
    const plan = [];

    if (!products.length) {
      return res.json({
        plan: [],
        totals: {},
        ai_summary: 'No products found. Add products with stock levels to generate a restock plan.'
      });
    }

    const today = new Date();
    for (const p of products) {
      let units30d = 0;
      if (p.sku && velocityBySku[p.sku]) units30d = velocityBySku[p.sku];
      else if (p.name && velocityByName[p.name.toLowerCase()]) units30d = velocityByName[p.name.toLowerCase()];

      const stock = parseInt(p.current_stock || 0);
      const reorder = parseInt(p.reorder_level || 0);
      const dailyVelocity = units30d / 30.0;

      let daysLeft = null;
      let stockoutDate = null;
      if (dailyVelocity > 0) {
        daysLeft = stock / dailyVelocity;
        const stockoutCalc = new Date(today);
        stockoutCalc.setDate(stockoutCalc.getDate() + Math.ceil(daysLeft));
        stockoutDate = stockoutCalc.toISOString().split('T')[0];
      }

      const predictedDemand = Math.ceil(dailyVelocity * horizonDays);
      const suggestedQty = Math.max(0, predictedDemand + reorder - stock);

      let urgency = 'healthy';
      if (dailyVelocity > 0 && (stock === 0 || daysLeft <= 3)) urgency = 'critical';
      else if (dailyVelocity > 0 && (daysLeft <= 7 || stock <= reorder)) urgency = 'soon';
      else if (dailyVelocity === 0 && stock > reorder) urgency = 'overstocked';

      plan.push({
        product_id: p.id,
        sku: p.sku || null,
        name: p.name,
        supplier: p.supplier || null,
        current_stock: stock,
        reorder_level: reorder,
        units_sold_30d: units30d,
        daily_velocity: Math.round(dailyVelocity * 100) / 100,
        days_of_stock_left: daysLeft !== null ? Math.round(daysLeft * 10) / 10 : null,
        stockout_date: stockoutDate,
        predicted_demand: predictedDemand,
        suggested_order_qty: suggestedQty,
        estimated_cost: _roundMoney(suggestedQty * (parseFloat(p.unit_cost) || 0)),
        urgency
      });
    }

    const urgencyRank = { critical: 0, soon: 1, healthy: 2, overstocked: 3 };
    plan.sort((a, b) => {
      const rankA = urgencyRank[a.urgency];
      const rankB = urgencyRank[b.urgency];
      if (rankA !== rankB) return rankA - rankB;
      return (b.suggested_order_qty || 0) - (a.suggested_order_qty || 0);
    });

    const buyItems = plan.filter(i => i.suggested_order_qty > 0);
    const totals = {
      horizon_days: horizonDays,
      items_to_restock: buyItems.length,
      total_units: buyItems.reduce((sum, i) => sum + i.suggested_order_qty, 0),
      total_cost: _roundMoney(buyItems.reduce((sum, i) => sum + i.estimated_cost, 0))
    };

    res.json({ plan, totals, ai_summary: `Restock plan for ${horizonDays} days: ${buyItems.length} items to restock.` });
  } catch (err) {
    console.error('Restock plan error:', err);
    res.status(500).json({ detail: 'Failed to generate restock plan' });
  }
});

// /analytics/compare
router.get('/compare', requireOwnerAnalytics, async (req, res) => {
  try {
    const userId = req.businessOwnerId;
    const { p1_start, p1_end, p2_start, p2_end } = req.query;
    if (!p1_start || !p1_end || !p2_start || !p2_end) {
      return res.status(400).json({ detail: 'Period dates required (p1_start, p1_end, p2_start, p2_end)' });
    }

    const calcMetrics = async (start, end) => {
      const orders = await queryAll('SELECT * FROM orders WHERE user_id = $1 AND date >= $2 AND date <= $3', [userId, start, end]);
      const investments = await queryAll('SELECT * FROM investments WHERE user_id = $1 AND date >= $2 AND date <= $3', [userId, start, end]);

      const rev = orders.reduce((sum, o) => sum + _orderSign(o.status) * ((parseFloat(o.amount) || 0) + (parseFloat(o.delivery_cost) || 0)), 0);
      const cnt = orders.length;
      const prof = orders.reduce((sum, o) => sum + _orderSign(o.status) * ((parseFloat(o.amount) || 0) - (parseFloat(o.product_cost) || 0)), 0);
      const delivery = orders.reduce((sum, o) => sum + _orderSign(o.status) * (parseFloat(o.delivery_cost) || 0), 0);
      const cogs = orders.reduce((sum, o) => sum + _orderSign(o.status) * (parseFloat(o.product_cost) || 0), 0);
      const customers = new Set(orders.map(o => o.customer_phone).filter(Boolean)).size;
      const avgOrder = cnt > 0 ? _roundMoney(rev / cnt) : 0;
      const invTotal = investments.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);
      const margin = rev > 0 ? Math.round((prof / rev) * 100 * 10) / 10 : 0;

      return {
        revenue: _roundMoney(rev),
        orders: cnt,
        profit: _roundMoney(prof),
        cogs: _roundMoney(cogs),
        delivery: _roundMoney(delivery),
        customers,
        avg_order_value: avgOrder,
        investment: _roundMoney(invTotal),
        profit_margin: margin
      };
    };

    const m1 = await calcMetrics(p1_start, p1_end);
    const m2 = await calcMetrics(p2_start, p2_end);

    const pctChange = (curr, prev) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prev) / Math.abs(prev)) * 100 * 10) / 10;
    };

    const insights = [];
    const metrics = [
      { label: 'Revenue', key: 'revenue', goodUp: true },
      { label: 'Profit', key: 'profit', goodUp: true },
      { label: 'Orders', key: 'orders', goodUp: true },
      { label: 'Customers', key: 'customers', goodUp: true },
      { label: 'Average order value', key: 'avg_order_value', goodUp: true },
      { label: 'Investment spending', key: 'investment', goodUp: false },
      { label: 'Delivery cost', key: 'delivery', goodUp: false },
      { label: 'Profit margin', key: 'profit_margin', goodUp: true },
    ];

    for (const m of metrics) {
      const curr = m1[m.key];
      const prev = m2[m.key];
      const change = pctChange(curr, prev);
      if (Math.abs(change) < 0.1) {
        insights.push({ text: `${m.label} remained stable.`, type: 'neutral' });
      } else {
        const direction = change > 0 ? 'increased' : 'decreased';
        const isGood = (change > 0) === m.goodUp;
        const suffix = m.key === 'profit_margin' ? '%' : '';
        insights.push({
          text: `${m.label} ${direction} by ${Math.abs(change)}% (from ${prev}${suffix} to ${curr}${suffix}).`,
          type: isGood ? 'positive' : 'negative'
        });
      }
    }

    res.json({
      period1: { label: `${p1_start} to ${p1_end}`, ...m1 },
      period2: { label: `${p2_start} to ${p2_end}`, ...m2 },
      chartData: [
        { metric: 'Revenue', 'Period A': m1.revenue, 'Period B': m2.revenue },
        { metric: 'Profit', 'Period A': m1.profit, 'Period B': m2.profit },
        { metric: 'Orders', 'Period A': m1.orders, 'Period B': m2.orders },
        { metric: 'Avg Order', 'Period A': m1.avg_order_value, 'Period B': m2.avg_order_value },
        { metric: 'Investment', 'Period A': m1.investment, 'Period B': m2.investment },
        { metric: 'Delivery', 'Period A': m1.delivery, 'Period B': m2.delivery },
      ],
      insights
    });
  } catch (err) {
    console.error('Compare error:', err);
    res.status(500).json({ detail: 'Failed to compare periods' });
  }
});

// /analytics/pl-statement
router.get('/pl-statement', requireOwnerAnalytics, async (req, res) => {
  try {
    const userId = req.businessOwnerId;
    const { month } = req.query;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ detail: 'Month parameter required in YYYY-MM format' });
    }

    const y = parseInt(month.split('-')[0]);
    const m = parseInt(month.split('-')[1]);
    const startDate = `${month}-01`;
    const endMonth = m === 12 ? 1 : m + 1;
    const endYear = m === 12 ? y + 1 : y;
    const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

    const orders = await queryAll('SELECT * FROM orders WHERE user_id = $1 AND date >= $2 AND date < $3', [userId, startDate, endDate]);
    const investments = await queryAll('SELECT * FROM investments WHERE user_id = $1 AND date >= $2 AND date < $3', [userId, startDate, endDate]);

    const cancelledReturned = orders.filter(o => isCancelledStatus(o.status));
    const cancelledReturnedAmount = cancelledReturned.reduce((sum, o) => sum + (parseFloat(o.amount) || 0) + (parseFloat(o.delivery_cost) || 0), 0);
    const cancelledReturnedCount = cancelledReturned.length;

    const grossRevenue = orders.reduce((sum, o) => sum + _orderSign(o.status) * ((parseFloat(o.amount) || 0) + (parseFloat(o.delivery_cost) || 0)), 0);
    const totalCOGS = orders.reduce((sum, o) => sum + _orderSign(o.status) * (parseFloat(o.product_cost) || 0), 0);
    const deliveryCosts = orders.reduce((sum, o) => sum + _orderSign(o.status) * (parseFloat(o.delivery_cost) || 0), 0);

    const grossProfit = grossRevenue - totalCOGS - deliveryCosts;

    const opexGroups = {};
    let totalOpex = 0;
    for (const inv of investments) {
      const cat = inv.category || 'Other';
      const amt = parseFloat(inv.amount) || 0;
      if (!opexGroups[cat]) opexGroups[cat] = 0;
      opexGroups[cat] += amt;
      totalOpex += amt;
    }
    const operatingExpenses = Object.entries(opexGroups).map(([category, amount]) => ({ category, amount: _roundMoney(amount) }));
    const netProfit = grossProfit - totalOpex;

    res.json({
      period: month,
      gross_revenue: _roundMoney(grossRevenue),
      total_cogs: _roundMoney(totalCOGS),
      delivery_costs: _roundMoney(deliveryCosts),
      gross_profit: _roundMoney(grossProfit),
      total_opex: _roundMoney(totalOpex),
      net_profit: _roundMoney(netProfit),
      cancelled_returned_amount: _roundMoney(cancelledReturnedAmount),
      cancelled_returned_count: cancelledReturnedCount,
      operating_expenses: operatingExpenses
    });
  } catch (err) {
    console.error('P&L statement error:', err);
    res.status(500).json({ detail: 'Failed to generate P&L statement' });
  }
});

module.exports = router;