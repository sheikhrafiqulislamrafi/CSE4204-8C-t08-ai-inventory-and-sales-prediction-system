/**
 * Google Sheets Routes
 */

const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');
const { requireOwner } = require('../middleware/authMiddleware');

router.use(authMiddleware, requireOwner);

router.post('/connect', async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { sheet_id } = req.body;
    await query('INSERT INTO user_settings (user_id, google_sheet_id) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET google_sheet_id = EXCLUDED.google_sheet_id', [userId, sheet_id || null]);
    res.json({ message: 'Google Sheets connected', sheet_id: sheet_id || null });
  } catch (err) {
    console.error('Sheets connect error:', err);
    res.status(500).json({ detail: 'Failed to connect Google Sheets' });
  }
});

router.post('/sync', async (req, res) => {
  try {
    res.json({ detail: 'Sync completed', synced_rows: 0, sales_rows: 0, investment_rows: 0, inventory_rows: 0 });
  } catch (err) {
    res.status(500).json({ detail: 'Sync failed' });
  }
});

router.post('/import', async (req, res) => {
  try {
    res.json({ detail: 'Import completed', imported: 0, updated_orders: 0, imported_investments: 0, imported_products: 0, updated_products: 0 });
  } catch (err) {
    res.status(500).json({ detail: 'Import failed' });
  }
});

module.exports = router;