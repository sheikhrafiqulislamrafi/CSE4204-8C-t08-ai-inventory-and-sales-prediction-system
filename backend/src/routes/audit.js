/**
 * Audit Log Routes
 */

const express = require('express');
const router = express.Router();
const { query, queryOne, queryAll } = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');
const { requireOwner } = require('../middleware/authMiddleware');

router.use(authMiddleware, requireOwner);

router.get('/', async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { entity, action, search, start_date, end_date, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let sql = 'SELECT * FROM audit_logs WHERE owner_id = $1';
    const params = [userId];
    let idx = 2;

    if (entity) { sql += ` AND entity = $${idx}`; params.push(entity); idx++; }
    if (action) { sql += ` AND action = $${idx}`; params.push(action); idx++; }
    if (search) { sql += ` AND (summary ILIKE $${idx} OR user_email ILIKE $${idx})`; params.push(`%${search}%`); idx++; }
    if (start_date) { sql += ` AND created_at >= $${idx}`; params.push(start_date); idx++; }
    if (end_date) { sql += ` AND created_at <= $${idx}`; params.push(`${end_date} 23:59:59`); idx++; }

    const countRes = await queryOne(sql.replace('SELECT *', 'SELECT COUNT(*) as total'), params);
    const total = parseInt(countRes?.total || 0);

    sql += ` ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
    params.push(parseInt(limit), offset);

    const items = await queryAll(sql, params);

    res.json({
      items: items.map(e => ({
        id: e.id,
        user_email: e.user_email,
        action: e.action,
        entity: e.entity,
        entity_id: e.entity_id,
        summary: e.summary,
        details: e.details ? JSON.parse(e.details) : null,
        created_at: e.created_at ? new Date(e.created_at).toISOString() : null
      })),
      total,
      page: parseInt(page),
      pages: Math.max(1, Math.ceil(total / parseInt(limit)))
    });
  } catch (err) {
    console.error('Audit log error:', err);
    res.status(500).json({ detail: 'Failed to fetch audit log' });
  }
});

module.exports = router;
