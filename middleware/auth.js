/**
 * auth.js
 * Authentication middleware for API routes
 */

const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

// JWT Secret - should be in environment variables in production
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

/**
 * Middleware to require authentication
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const requireAuth = (req, res, next) => {
  // Get token from header
  const token = req.header('x-auth-token');
  
  // Check if no token
  if (!token) {
    return res.status(401).json({ error: 'No authentication token, access denied' });
  }
  
  try {
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Add user from payload to request
    req.user = decoded.user;
    next();
  } catch (err) {
    logger.warn(`Invalid authentication token: ${err.message}`);
    res.status(401).json({ error: 'Invalid token, access denied' });
  }
};

/**
 * Middleware to require admin role
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const requireAdmin = (req, res, next) => {
  // Check if authenticated
  requireAuth(req, res, () => {
    // Check if user has admin role
    if (!req.user.roles || !req.user.roles.includes('admin')) {
      logger.warn(`User ${req.user.id} attempted to access admin-only resource`);
      return res.status(403).json({ error: 'Access denied: Admin privileges required' });
    }
    
    next();
  });
};

/**
 * Create a JWT token for a user
 * @param {Object} user - User object
 * @param {string} expiresIn - Token expiration (e.g., '1h', '7d')
 * @returns {string} JWT token
 */
const createToken = (user, expiresIn = '24h') => {
  const payload = {
    user: {
      id: user.id,
      email: user.email,
      roles: user.roles || ['user']
    }
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
};

module.exports = {
  requireAuth,
  requireAdmin,
  createToken
};
