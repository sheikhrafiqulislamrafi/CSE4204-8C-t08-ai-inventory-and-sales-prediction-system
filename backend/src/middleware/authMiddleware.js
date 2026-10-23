
const jwt = require('jsonwebtoken');
const { queryOne } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'myshop-ai-secret-key-2026';

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ detail: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    const user = await queryOne(
      'SELECT id, email, business_name, role, parent_id, is_active FROM users WHERE id = $1',
      [decoded.user_id]
    );
    if (!user || !user.is_active) {
      return res.status(401).json({ detail: 'Invalid or inactive account' });
    }

    let owner = user;
    if (user.role === 'staff') {
      if (!user.parent_id) return res.status(403).json({ detail: 'Staff account has no business owner' });
      owner = await queryOne(
        "SELECT id, email, business_name, role, is_active FROM users WHERE id = $1 AND role = 'owner'",
        [user.parent_id]
      );
      if (!owner || !owner.is_active) {
        return res.status(403).json({ detail: 'Staff business owner is unavailable' });
      }
    }

    req.user = { ...decoded, user_id: user.id, email: user.email, role: user.role, business_name: owner.business_name };
    req.businessOwnerId = owner.id;
    req.actorUserId = user.id;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ detail: 'Invalid token' });
    }
    console.error('Authentication lookup error:', err);
    return res.status(500).json({ detail: 'Authentication failed' });
  }
}

function requireOwner(req, res, next) {
  if (req.user?.role !== 'owner') {
    return res.status(403).json({ detail: 'Owner access required' });
  }
  next();
}

module.exports = authMiddleware;
module.exports.requireOwner = requireOwner;
