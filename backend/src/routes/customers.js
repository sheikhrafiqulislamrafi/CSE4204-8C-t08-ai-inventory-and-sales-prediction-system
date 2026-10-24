/**
 * Customers Routes - Full implementation matching Python reference
 */

const express = require('express');
const router = express.Router();
const { query, queryOne, queryAll } = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');
const { customerAggregates, daysSince } = require('../utils/helpers');

router.use(authMiddleware);

// /customers - Segmented customers (VIP, Loyal, At-Risk, New)
router.get('/', async (req, res) => {
  try {
    const userId = req.businessOwnerId;
    const inactiveDays = parseInt(req.query.inactive_days || 30);
    const orders = await queryAll('SELECT * FROM orders WHERE user_id = $1', [userId]);
    const customers = customerAggregates(orders, inactiveDays);
    res.json(customers);
  } catch (err) {
    console.error('Customers error:', err);
    res.status(500).json({ detail: 'Failed to fetch customers' });
  }
});

// /customers/at-risk
router.get('/at-risk', async (req, res) => {
  try {
    const userId = req.businessOwnerId;
    const days = parseInt(req.query.inactive_days || 30);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    const results = await queryAll(`
      SELECT customer_name, customer_phone, MAX(date) as last_order_date,
             COUNT(*) as order_count, SUM(amount) as total_spent
      FROM orders WHERE user_id = $1 AND date < $2 AND status NOT IN ('cancelled', 'canceled', 'returned')
      GROUP BY customer_name, customer_phone ORDER BY last_order_date ASC`, [userId, cutoffStr]);

    res.json(results.map(r => ({
      ...r,
      orders: parseInt(r.order_count || 0),
      spent: parseFloat(r.total_spent || 0),
      is_at_risk: true,
      days_since_last_order: daysSince(r.last_order_date)
    })));
  } catch (err) {
    console.error('At-risk customers error:', err);
    res.status(500).json({ detail: 'Failed to fetch at-risk customers' });
  }
});

// /customers/win-back/preview
router.post('/win-back/preview', async (req, res) => {
  try {
    const userId = req.businessOwnerId;
    const {
      discount_percent = 10,
      inactive_days = 30,
      language = 'bn',
      custom_note = '',
      limit = 50,
      customer_phones = null
    } = req.body;

    const orders = await queryAll('SELECT * FROM orders WHERE user_id = $1', [userId]);
    const allCustomers = customerAggregates(orders, inactive_days);

    // Filter to at-risk; if a single customer is explicitly selected, use it
    let atRisk = allCustomers.filter(c => c.is_at_risk);

    // Allow selecting a single customer by name/phone from the frontend modal
    if (req.body.selected_customer_name || req.body.selected_customer_phone) {
      atRisk = atRisk.filter(c =>
        (req.body.selected_customer_name && c.name === req.body.selected_customer_name) ||
        (req.body.selected_customer_phone && c.phone === req.body.selected_customer_phone)
      );
    } else if (customer_phones && Array.isArray(customer_phones) && customer_phones.length > 0) {
      const selected = new Set(customer_phones);
      atRisk = atRisk.filter(c => selected.has(c.phone));
    } else {
      atRisk = atRisk.slice(0, limit);
    }

    // Generate condition-based messages
    const messages = atRisk.map(c => {
      const discount = discount_percent || 10;
      const days = c.days_since_last_order || 30;
      const langText = language === 'en' ? 'Hello' : (language === 'bn' ? 'সালাম' : 'Hello');
      let message = '';

      // Condition-based message logic
      if (days > 90) {
        message = `${langText} ${c.name || 'Customer'}! We really miss you — it's been ${days} days! Come back with ${discount}% off your next order.`;
      } else if (days > 30) {
        message = `${langText} ${c.name || 'Customer'}! We noticed it's been ${days} days. We saved ${discount}% just for you — come back soon!`;
      } else {
        message = `${langText} ${c.name || 'Customer'}! We miss you! Get ${discount}% off your next order!`;
      }
      if (custom_note) message += ` ${custom_note}`;
      if (c.total_revenue > 5000) message += ` As a valued customer with ৳${Math.round(c.total_revenue)} lifetime spend, your loyalty means everything.`;

      return {
        name: c.name || 'Customer',
        phone: c.phone || '—',
        message: message,
        days_inactive: days,
        segment: c.segment,
        whasapp_url: c.phone ? `https://wa.me/${c.phone.replace(/\D/g,'')}` : null,
        total_spend: c.total_revenue || 0
      };
    });

    const combinedSpend = messages.reduce((sum, m) => sum + (m.total_spend || 0), 0);
    const brief = `Win-back campaign for ${messages.length} at-risk customer(s). Average inactivity: ${messages.length ? Math.round(messages.reduce((s,m)=>s+(m.days_inactive||0),0)/messages.length) : 0} days. Combined lifetime value: ৳${Math.round(combinedSpend)}.`;

    res.json({
      messages: messages,
      campaign_brief: brief,
      at_risk_count: messages.length,
      combined_lifetime_spend: combinedSpend
    });
  } catch (err) {
    console.error('Win-back preview error:', err);
    res.status(500).json({ detail: 'Failed to generate win-back preview' });
  }
});

module.exports = router;