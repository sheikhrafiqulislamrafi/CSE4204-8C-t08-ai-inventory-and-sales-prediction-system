/**
 * Investments Routes - Full Python reference match
 */

const express = require('express');
const router = express.Router();
const { query, queryOne, queryAll, _roundMoney } = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');
const { requireOwner } = require('../middleware/authMiddleware');
const { upload, parseInvestmentsExcel } = require('../middleware/uploadMiddleware');

router.use(authMiddleware, requireOwner);

// Get investments with pagination/filter
router.get('/', async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { category, start_date, end_date, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let sql = 'SELECT * FROM investments WHERE user_id = $1';
    const params = [userId];
    let idx = 2;

    if (category) { sql += ` AND category = $${idx}`; params.push(category); idx++; }
    if (start_date) { sql += ` AND date >= $${idx}`; params.push(start_date); idx++; }
    if (end_date) { sql += ` AND date <= $${idx}`; params.push(end_date); idx++; }

    sql += ' ORDER BY date DESC, id DESC';
    const totalRes = await queryOne(`SELECT COUNT(*) as total FROM investments WHERE user_id = $1${category ? ` AND category = $2` : ''}${start_date ? ` AND date >= $3` : ''}${end_date ? ` AND date <= $4` : ''}`, [userId, ...(category ? [category] : []), ...(start_date ? [start_date] : []), ...(end_date ? [end_date] : [])]);

    sql += ` LIMIT $${idx} OFFSET $${idx + 1}`;
    params.push(parseInt(limit), offset);

    const items = await queryAll(sql, params);
    const total = parseInt(totalRes?.total || 0);

    res.json({
      items: items.map(i => ({
        id: i.id,
        date: i.date,
        category: i.category,
        amount: _roundMoney(i.amount),
        notes: i.notes,
        created_at: i.created_at ? new Date(i.created_at).toISOString() : null,
        updated_at: i.updated_at ? new Date(i.updated_at).toISOString() : null
      })),
      total,
      page: parseInt(page),
      pages: Math.max(1, Math.ceil(total / parseInt(limit)))
    });
  } catch (err) {
    console.error('Get investments error:', err);
    res.status(500).json({ detail: 'Failed to fetch investments' });
  }
});

// Create investment
router.post('/', async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { date, category = 'Other', amount, notes } = req.body;

    const result = await queryOne(
      `INSERT INTO investments (user_id, date, category, amount, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, date, category, amount, notes || null]
    );

    res.status(201).json({
      id: result.id,
      date: result.date,
      category: result.category,
      amount: _roundMoney(result.amount),
      notes: result.notes,
      created_at: result.created_at ? new Date(result.created_at).toISOString() : null,
      updated_at: result.updated_at ? new Date(result.updated_at).toISOString() : null
    });
  } catch (err) {
    console.error('Create investment error:', err);
    res.status(500).json({ detail: 'Failed to create investment' });
  }
});

// Bulk upload investments
router.post('/bulk-upload', upload.single('file'), async (req, res) => {
  try {
    let investments;
    if (req.file) {
      investments = parseInvestmentsExcel(req.file.buffer, req.file.originalname);
    } else if (req.body.data) {
      investments = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body.data;
    } else if (Array.isArray(req.body)) {
      investments = req.body;
    } else {
      return res.status(400).json({ detail: 'No file or data provided' });
    }

    if (!Array.isArray(investments)) return res.status(400).json({ detail: 'Expected array of investments' });
    if (investments[0] && !investments[0].Amount && !investments[0].amount) return res.status(422).json({ detail: "File must contain an 'Amount' column" });
    if (investments[0] && !investments[0].Date && !investments[0].date) return res.status(422).json({ detail: "File must contain a 'Date' column" });
    if (investments[0] && !investments[0].Category && !investments[0].category) return res.status(422).json({ detail: "File must contain a 'Category' column" });

    const userId = req.user.user_id;
    let imported = 0;

    for (const inv of investments) {
      const amountVal = inv.Amount || inv.amount || 0;
      const amount = typeof amountVal === 'string' ? parseFloat(amountVal.replace(/[৳,]/g, '')) || 0 : parseFloat(amountVal) || 0;
      if (amount <= 0) continue;

      const dateStr = String(inv.Date || inv.date || '').trim();
      if (!dateStr) continue;

      const category = String(inv.Category || inv.category || 'Other').trim();
      const notes = String(inv.Notes || inv['Notes / Quantity'] || inv.notes || '').trim();

      await queryOne(
        `INSERT INTO investments (user_id, date, category, amount, notes) VALUES ($1, $2, $3, $4, $5)`,
        [userId, dateStr, category, amount, notes || null]
      );
      imported++;
    }

    res.status(201).json({ message: `Successfully imported ${imported} investments.` });
  } catch (err) {
    console.error('Bulk upload investments error:', err);
    res.status(500).json({ detail: 'Failed to import investments: ' + err.message });
  }
});

// Update investment
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user.user_id;
    const id = parseInt(req.params.id);
    const { date, category, amount, notes } = req.body;

    const result = await queryOne(
      `UPDATE investments SET date = COALESCE($2, date), category = COALESCE($3, category), amount = COALESCE($4, amount), notes = COALESCE($5, notes), updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $6 RETURNING *`,
      [id, date, category, amount, notes, userId]
    );
    if (!result) return res.status(404).json({ detail: 'Investment not found' });
    res.json({ ...result, amount: _roundMoney(result.amount) });
  } catch (err) {
    console.error('Update investment error:', err);
    res.status(500).json({ detail: 'Failed to update investment' });
  }
});

// Delete investment
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.user_id;
    const id = parseInt(req.params.id);
    await query('DELETE FROM investments WHERE id = $1 AND user_id = $2', [id, userId]);
    res.json({ message: 'Investment entry deleted' });
  } catch (err) {
    console.error('Delete investment error:', err);
    res.status(500).json({ detail: 'Failed to delete investment' });
  }
});

module.exports = router;