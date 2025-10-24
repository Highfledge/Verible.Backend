import { verifyToken } from '../utils/jwt.js';
import User from '../models/User.model.js';

/**
 * Middleware to check if user is authenticated
 * Extracts and verifies JWT token from Authorization header
 */
export const isAuthenticated = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = verifyToken(token);
    
    // Get user from database
    const user = await User.findById(decoded.userId).select('-passwordHash');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found. Invalid token.'
      });
    }

    // Attach user to request object
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: error.message || 'Invalid or expired token'
    });
  }
};

/**
 * Middleware to check if user has admin role
 * Must be used after isAuthenticated middleware
 */
export const isAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.'
    });
  }

  next();
};

/**
 * Middleware to check if user has seller role
 * Must be used after isAuthenticated middleware
 */
export const isSeller = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (req.user.role !== 'seller' && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Seller privileges required.'
    });
  }

  next();
};

/**
 * Middleware to check if user has seller or admin role
 * Must be used after isAuthenticated middleware
 */
export const isSellerOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (req.user.role !== 'seller' && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Seller or Admin privileges required.'
    });
  }

  next();
};

/**
 * Middleware to check if user is verified
 * Must be used after isAuthenticated middleware
 */
export const isVerified = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (!req.user.verified) {
    return res.status(403).json({
      success: false,
      message: 'Account not verified. Please verify your account first.'
    });
  }

  next();
};

/**
 * Middleware to check if user account is active (not suspended)
 * Must be used after isAuthenticated middleware
 */
export const isActive = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (req.user.isActive === false) {
    return res.status(403).json({
      success: false,
      message: 'Account suspended. Please contact support.'
    });
  }

  next();
};

/**
 * Optional authentication middleware
 * Doesn't fail if no token is provided, but validates if present
 * Useful for endpoints that support both authenticated and anonymous access
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue without user
      req.user = null;
      return next();
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.userId).select('-passwordHash');
    
    req.user = user || null;
    next();
  } catch (error) {
    // Token invalid, continue without user
    req.user = null;
    next();
  }
};

