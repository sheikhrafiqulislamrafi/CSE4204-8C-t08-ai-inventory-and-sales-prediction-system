/**
 * AI Routes - Insights & Query
 */

const express = require('express');
const router = express.Router();
const { query, queryAll } = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');
const { requireOwner } = require('../middleware/authMiddleware');
const { generateInsights, answerQuery, generateForecastInsights, generateRestockPlan, generatePLSummary, generateMonthlyExecutiveSummary, generateWinbackMessages } = require('../ai_service/ai_service');

router.use(authMiddleware, requireOwner);

router.post('/insights', async (req, res) => {
  try {
    const userId = req.businessOwnerId;
    const orders = await queryAll('SELECT * FROM orders WHERE user_id = $1 AND status NOT IN (\'cancelled\', \'canceled\', \'returned\') ORDER BY date', [userId]);
    const products = await queryAll('SELECT * FROM products WHERE user_id = $1', [userId]);
    const investments = await queryAll('SELECT * FROM investments WHERE user_id = $1', [userId]);

    const totalOrders = orders.length;
    const delivered = orders.filter(o => o.status === 'delivered').length;
    const returned = orders.filter(o => o.status === 'returned').length;
    const cancelled = orders.filter(o => ['cancelled', 'canceled'].includes(o.status)).length;
    const totalRev = orders.reduce((s, o) => s + (o.status === 'delivered' ? 1 : 0) * (parseFloat(o.amount) || 0), 0);
    const totalProfitCalc = orders.reduce((s, o) => s + (o.status === 'delivered' ? 1 : 0) * (parseFloat(o.profit) || 0), 0);
    const uniquePhones = new Set(orders.map(o => o.customer_phone).filter(Boolean));
    const outOfStockItems = products.filter(p => parseInt(p.current_stock || 0) <= 0);
    const lowStockItems = products.filter(p => parseInt(p.current_stock || 0) > 0 && parseInt(p.current_stock || 0) <= (parseInt(p.reorder_level || 0)));

    const context = {
      business_name: req.user.business_name || 'My Shop',
      total_orders: totalOrders,
      delivered_orders: delivered,
      pending_orders: orders.filter(o => o.status === 'pending').length,
      returned_orders: returned,
      cancelled_orders: cancelled,
      return_rate_pct: totalOrders > 0 ? Math.round((returned / totalOrders) * 100 * 10) / 10 : 0,
      total_revenue: Math.round(totalRev * 100) / 100,
      total_profit: Math.round(totalProfitCalc * 100) / 100,
      total_delivery_cost: Math.round(orders.reduce((s, o) => s + (parseFloat(o.delivery_cost) || 0), 0) * 100) / 100,
      unique_customers: uniquePhones.size,
      top_products: [],
      top_customers: [],
      out_of_stock_items: outOfStockItems.length,
      low_stock_items: lowStockItems.length,
      today_orders: orders.filter(o => o.date && new Date(o.date).toDateString() === new Date().toDateString()).length,
      today_revenue: Math.round(orders.filter(o => o.date && new Date(o.date).toDateString() === new Date().toDateString()).reduce((s, o) => s + (parseFloat(o.amount) || 0), 0) * 100) / 100,
      today_profit: Math.round(orders.filter(o => o.date && new Date(o.date).toDateString() === new Date().toDateString()).reduce((s, o) => s + (parseFloat(o.profit) || 0), 0) * 100) / 100,
      last_7_days_orders: 0,
      last_7_days_revenue: 0,
      last_7_days_profit: 0,
      avg_order_value: totalOrders > 0 ? Math.round((totalRev / totalOrders) * 100) / 100 : 0,
      profit_margin_pct: totalRev > 0 ? Math.round((totalProfitCalc / totalRev) * 100 * 10) / 10 : 0,
      total_products_in_inventory: products.length,
      total_stock_value: Math.round(products.reduce((s, p) => s + (parseFloat(p.current_stock || 0) * (parseFloat(p.price || 0))), 0) * 100) / 100,
      total_investment: Math.round(investments.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0) * 100) / 100,
      investment_by_category: {},
      net_cash_flow: Math.round((totalProfitCalc - investments.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)) * 100) / 100,
    };

    const insightsText = await generateInsights(context.business_name, context);
    res.json({ insights: insightsText || `AI Insights: ${context.total_orders} orders, ৳${context.total_revenue} revenue.` });
  } catch (err) {
    console.error('AI insights error:', err);
    res.status(500).json({ detail: 'Failed to generate AI insights' });
  }
});

router.post('/query', async (req, res) => {
  try {
    const { question } = req.body;
    const userId = req.businessOwnerId;
    const orders = await queryAll('SELECT * FROM orders WHERE user_id = $1', [userId]);
    const products = await queryAll('SELECT * FROM products WHERE user_id = $1', [userId]);
    const customersSql = await queryAll('SELECT DISTINCT customer_phone FROM orders WHERE user_id = $1', [userId]);
    const uniqueCustomers = new Set(customersSql.map(c => c.customer_phone).filter(Boolean)).size;
    const totalOrders = orders.length;
    const totalRev = orders.reduce((s, o) => s + (parseFloat(o.amount) || 0), 0);
    const totalProfitCalc = orders.reduce((s, o) => s + (parseFloat(o.profit) || 0), 0);

    const context = {
      business_name: req.user.business_name || 'My Shop',
      total_orders: totalOrders,
      total_revenue: Math.round(totalRev * 100) / 100,
      total_profit: Math.round(totalProfitCalc * 100) / 100,
      unique_customers: uniqueCustomers,
      today_revenue: Math.round(orders.filter(o => o.date && new Date(o.date).toDateString() === new Date().toDateString()).reduce((s, o) => s + (parseFloat(o.amount) || 0), 0) * 100) / 100,
      today_profit: Math.round(orders.filter(o => o.date && new Date(o.date).toDateString() === new Date().toDateString()).reduce((s, o) => s + (parseFloat(o.profit) || 0), 0) * 100) / 100,
      out_of_stock_items: products.filter(p => parseInt(p.current_stock || 0) <= 0).length,
      low_stock_items: products.filter(p => parseInt(p.current_stock || 0) > 0 && parseInt(p.current_stock || 0) <= (parseInt(p.reorder_level || 0))).length,
      profit_margin_pct: totalRev > 0 ? Math.round((totalProfitCalc / totalRev) * 100 * 10) / 10 : 0,
      avg_order_value: totalOrders > 0 ? Math.round((totalRev / totalOrders) * 100) / 100 : 0,
      today_orders: orders.filter(o => o.date && new Date(o.date).toDateString() === new Date().toDateString()).length,
      return_rate_pct: 0,
    };

    const answerText = await answerQuery(req.user.business_name || 'My Shop', question || '', context);
    res.json({ answer: answerText || `Answer for your question about ${context.business_name}: ${context.total_orders} orders, ৳${context.total_revenue} revenue.`, context });
  } catch (err) {
    console.error('AI query error:', err);
    res.status(500).json({ detail: 'Failed to process AI query' });
  }
});

module.exports = router;