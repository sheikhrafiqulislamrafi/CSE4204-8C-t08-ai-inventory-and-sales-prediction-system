/**
 * Staff Routes
 */

const express = require('express');
const router = express.Router();
const { query, queryOne, queryAll } = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');
const { requireOwner } = require('../middleware/authMiddleware');
const bcrypt = require('bcryptjs');

router.use(authMiddleware, requireOwner);

router.get('/', async (req, res) => {
  try {
    const userId = req.user.user_id;
    const staff = await queryAll('SELECT id, email, business_name as name, role, is_active, created_at FROM users WHERE parent_id = $1', [userId]);
    res.json(staff);
  } catch (err) {
    console.error('Get staff error:', err);
    res.status(500).json({ detail: 'Failed to fetch staff' });
  }
});

router.post('/', async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { email, password, business_name, role = 'staff' } = req.body;
    const hashed = await bcrypt.hash(password || 'temp1234', 10);
    const user = await queryOne(
      'INSERT INTO users (email, hashed_password, business_name, role, parent_id, is_active) VALUES ($1, $2, $3, $4, $5, true) RETURNING id, email, business_name, role',
      [email, hashed, business_name || email.split('@')[0], role, userId]
    );
    await queryOne('INSERT INTO user_settings (user_id) VALUES ($1)', [user.id]);
    res.status(201).json({ id: user.id, email: user.email, business_name: user.business_name, role: user.role });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ detail: 'Email already exists' });
    console.error('Create staff error:', err);
    res.status(500).json({ detail: 'Failed to create staff' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.user_id;
    const id = parseInt(req.params.id);
    await query('DELETE FROM users WHERE id = $1 AND parent_id = $2', [id, userId]);
    res.json({ message: 'Staff deleted' });
  } catch (err) {
    console.error('Delete staff error:', err);
    res.status(500).json({ detail: 'Failed to delete staff' });
  }
});

module.exports = router;