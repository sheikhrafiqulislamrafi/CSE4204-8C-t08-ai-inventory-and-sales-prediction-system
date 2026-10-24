/**
 * Settings Routes
 */

const express = require('express');
const router = express.Router();
const { query, queryOne } = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');
const { requireOwner } = require('../middleware/authMiddleware');

router.use(authMiddleware, requireOwner);

router.get('/', async (req, res) => {
  try {
    const userId = req.user.user_id;
    let row = await queryOne('SELECT * FROM user_settings WHERE user_id = $1', [userId]);
    if (!row) {
      row = { delivery_cost: 0, notification_email: req.user.email, google_sheet_id: null, gemini_api_key: null, report_time: '20:00' };
    }
    const result = {
      delivery_cost: row.delivery_cost || 0,
      notification_email: row.notification_email || req.user.email,
      google_sheet_id: row.google_sheet_id || null,
      google_credentials_configured: !!(row.google_credentials),
      gemini_api_key: row.gemini_api_key || null,
      report_time: row.report_time || '20:00'
    };
    res.json(result);
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ detail: 'Failed to fetch settings' });
  }
});

router.put('/', async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { delivery_cost, notification_email, google_sheet_id, gemini_api_key, report_time } = req.body;

    await query(
      `INSERT INTO user_settings (user_id, delivery_cost, notification_email, google_sheet_id, gemini_api_key, report_time)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id) DO UPDATE SET
         delivery_cost = COALESCE($2, user_settings.delivery_cost),
         notification_email = COALESCE($3, user_settings.notification_email),
         google_sheet_id = COALESCE($4, user_settings.google_sheet_id),
         gemini_api_key = COALESCE($5, user_settings.gemini_api_key),
         report_time = COALESCE($6, user_settings.report_time)`,
      [userId, delivery_cost ?? null, notification_email ?? null, google_sheet_id ?? null, gemini_api_key ?? null, report_time ?? null]
    );

    res.json({ message: 'Settings updated' });
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ detail: 'Failed to update settings' });
  }
});

module.exports = router;