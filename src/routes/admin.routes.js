import express from 'express';
import { body } from 'express-validator';
import {
  adminLogin,
  getCurrentAdmin,
  getSystemOverview,
  getAllUsers,
  getUserDetails,
  updateUserStatus,
  deleteUser,
  makeUserAdmin,
  removeUserAdmin,
  getAllSellers,
  getSellerDetails,
  updateSellerStatus,
  verifySeller,
  deleteSeller,
  getAllFlags,
  reviewFlag,
  getSystemHealth
} from '../controllers/admin.controller.js';
import { isAuthenticated, isAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

// Admin authentication routes
router.post('/login', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
], adminLogin);

router.get('/me', isAuthenticated, isAdmin, getCurrentAdmin);

// System analytics routes
router.get('/analytics/overview', isAuthenticated, isAdmin, getSystemOverview);

// User management routes
router.get('/users', isAuthenticated, isAdmin, getAllUsers);

router.get('/users/:id', isAuthenticated, isAdmin, getUserDetails);
router.delete('/users/:id', isAuthenticated, isAdmin, deleteUser);
router.put('/users/:id/status', [
    isAuthenticated,
    isAdmin,
    body('status')
      .isIn(['active', 'suspended'])
      .withMessage('Status must be either "active" or "suspended"'),
    updateUserStatus
  ]);

router.put('/users/:id/make-admin', isAuthenticated, isAdmin, makeUserAdmin);
router.put('/users/:id/remove-admin', isAuthenticated, isAdmin, removeUserAdmin);

// Seller management routes
router.get('/sellers', isAuthenticated, isAdmin, getAllSellers);
router.get('/sellers/:id', isAuthenticated, isAdmin, getSellerDetails);
router.put('/sellers/:id/status', [
  isAuthenticated,
  isAdmin,
  body('isActive')
    .isBoolean()
    .withMessage('isActive must be a boolean value'),
  updateSellerStatus
]);
router.post('/sellers/:id/verify', [
  isAuthenticated,
  isAdmin,
  body('verificationStatus')
    .isIn(['email-verified', 'phone-verified', 'id-verified'])
    .withMessage('Invalid verification status'),
  verifySeller
]);
router.delete('/sellers/:id', isAuthenticated, isAdmin, deleteSeller);

// Flag management routes
router.get('/flags', isAuthenticated, isAdmin, getAllFlags);
router.put('/flags/:id/review', [
  isAuthenticated,
  isAdmin,
  body('type')
    .isIn(['seller', 'listing'])
    .withMessage('Type must be either "seller" or "listing"'),
  body('flagIndex')
    .isInt({ min: 0 })
    .withMessage('Flag index must be a non-negative integer'),
  body('action')
    .isIn(['dismissed', 'upheld'])
    .withMessage('Action must be either "dismissed" or "upheld"'),
  body('adminNotes')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Admin notes must be a string with max 500 characters'),
  reviewFlag
]);

// System management routes
router.get('/system/health', isAuthenticated, isAdmin, getSystemHealth);

export default router;
