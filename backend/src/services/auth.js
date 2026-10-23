const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../../database/connection');

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-before-deploying-to-production';
const JWT_EXPIRY = process.env.ACCESS_TOKEN_EXPIRE_MINUTES || 720;

/**
 * Hash a password
 */
async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
}

/**
 * Verify password against hash
 */
async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

/**
 * Generate JWT token for a user
 */
function generateToken(user) {
  const payload = {
    user_id: user.id,
    email: user.email,
    role: user.role,
    business_name: user.business_name
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: `${JWT_EXPIRY}m` });
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

/**
 * Middleware to protect routes
 */
async function protect(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // Fetch fresh user from DB
  const user = await db.queryOne(
    'SELECT id, email, business_name, role, parent_id, is_active FROM users WHERE id = $1',
    [decoded.user_id]
  );

  if (!user || !user.is_active) {
    return res.status(401).json({ error: 'User not found or inactive' });
  }

  req.user = user;
  next();
}

/**
 * Role-based access control middleware
 */
function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (Array.isArray(roles) && !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    if (typeof roles === 'string' && req.user.role !== roles) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

/**
 * Staff-specific restriction: can only edit today's orders
 */
function staffEditRestriction(req, res, next) {
  if (req.user.role === 'staff') {
    const today = new Date().toISOString().split('T')[0];
    if (req.method === 'PUT' && req.body.date) {
      const orderDate = new Date(req.body.date).toISOString().split('T')[0];
      if (orderDate !== today) {
        return res.status(403).json({ error: 'Staff can only edit today\'s orders' });
      }
    }
  }
  next();
}

/**
 * Register new user (owner/staff)
 */
async function registerUser(email, password, business_name, role = 'owner', parent_id = null) {
  const hashedPassword = await hashPassword(password);
  const result = await db.queryOne(
    `INSERT INTO users (email, hashed_password, business_name, role, parent_id, is_active)
     VALUES ($1, $2, $3, $4, $5, true)
     RETURNING id, email, business_name, role, parent_id, created_at`,
    [email, hashedPassword, business_name, role, parent_id]
  );
  // Create default user settings
  await db.query(
    'INSERT INTO user_settings (user_id) VALUES ($1)',
    [result.id]
  );
  return result;
}

/**
 * Authenticate user and return token
 */
async function authenticateUser(email, password) {
  const user = await db.queryOne(
    'SELECT id, email, hashed_password, business_name, role, parent_id, is_active FROM users WHERE email = $1',
    [email]
  );
  if (!user || !user.is_active) return null;

  const isValid = await verifyPassword(password, user.hashed_password);
  if (!isValid) return null;

  const { hashed_password, ...userWithoutPassword } = user;
  const token = generateToken(userWithoutPassword);
  return { user: userWithoutPassword, token };
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  protect,
  requireRole,
  staffEditRestriction,
  registerUser,
  authenticateUser
};
