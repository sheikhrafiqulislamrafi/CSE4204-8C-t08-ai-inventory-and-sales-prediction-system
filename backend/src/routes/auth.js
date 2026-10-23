const express = require('express');
const router = express.Router();
const { query, queryOne, queryAll } = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'myshop-ai-secret-key-2026';

async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
}

async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

function generateToken(user) {
  return jwt.sign({
    user_id: user.id,
    email: user.email,
    role: user.role,
    business_name: user.business_name
  }, JWT_SECRET, { expiresIn: '720m' });
}

async function businessContextFor(user) {
  if (user.role !== 'staff') {
    return { ownerId: user.id, businessName: user.business_name };
  }

  if (!user.parent_id) return null;
  const owner = await queryOne(
    "SELECT id, business_name, is_active FROM users WHERE id = $1 AND role = 'owner'",
    [user.parent_id]
  );
  if (!owner || !owner.is_active) return null;
  return { ownerId: owner.id, businessName: owner.business_name };
}

function withBusinessContext(user, context) {
  return {
    ...user,
    account_business_name: user.business_name,
    business_name: context.businessName,
    business_owner_id: context.ownerId
  };
}

router.post('/register', async (req, res) => {
  try {
    const { email, password, business_name } = req.body;
    if (!email || !password || !business_name) {
      return res.status(400).json({ detail: 'Missing required fields' });
    }
    const hashedPassword = await hashPassword(password);
    const user = await queryOne(
      `INSERT INTO users (email, hashed_password, business_name, role, parent_id, is_active) VALUES ($1, $2, $3, $4, $5, true) RETURNING id, email, business_name, role, parent_id, created_at`,
      [email, hashedPassword, business_name || 'owner', 'owner', null]
    );
    await query('INSERT INTO user_settings (user_id) VALUES ($1)', [user.id]);
    const token = generateToken(user);
    res.status(201).json({ user, token });
  } catch (err) {
    if (err.code === '23505') res.status(409).json({ detail: 'Email already exists' });
    else { console.error('Register error:', err); res.status(500).json({ detail: 'Registration failed' }); }
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await queryOne('SELECT * FROM users WHERE email = $1', [username]);
    if (!user || !user.is_active) return res.status(401).json({ detail: 'Invalid credentials' });
    const valid = await verifyPassword(password, user.hashed_password);
    if (!valid) return res.status(401).json({ detail: 'Invalid credentials' });
    const { hashed_password, ...userWithoutPass } = user;
    const context = await businessContextFor(userWithoutPass);
    if (!context) return res.status(403).json({ detail: 'Staff business owner is unavailable' });
    const token = generateToken(userWithoutPass);
    res.json({ user: withBusinessContext(userWithoutPass, context), token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ detail: 'Login failed' });
  }
});

router.get('/me', require('../middleware/authMiddleware'), async (req, res) => {
  try {
    const user = await queryOne(
      'SELECT id, email, business_name, role, parent_id, is_active, created_at FROM users WHERE id = $1',
      [req.user.user_id]
    );
    const context = user && await businessContextFor(user);
    if (!context) return res.status(403).json({ detail: 'Staff business owner is unavailable' });
    res.json(withBusinessContext(user, context));
  } catch (err) {
    console.error('Get current user error:', err);
    res.status(500).json({ detail: 'Failed to fetch current user' });
  }
});

module.exports = router;