import express from 'express';
import { body } from 'express-validator';
import {
  updateProfile,
  deleteAccount,
  getMyFeedback,
  getMyInteractions
} from '../controllers/user.controller.js';
import { isAuthenticated, isActive } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @route   PUT /api/users/profile
 * @desc    Update own profile
 * @access  Private
 */
router.put(
  '/profile',
  isAuthenticated,
  isActive,
  [
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters'),
    body('email')
      .optional()
      .trim()
      .isEmail()
      .withMessage('Please provide a valid email')
      .toLowerCase(),
    body('phone')
      .optional()
      .trim()
      .matches(/^\+?[1-9]\d{1,14}$/)
      .withMessage('Please provide a valid phone number')
  ],
  updateProfile
);



/**
 * @route   DELETE /api/users/account
 * @desc    Delete own account
 * @access  Private
 */
router.delete('/account', isAuthenticated, isActive, deleteAccount);

/**
 * @route   GET /api/users/my-feedback
 * @desc    Get user's feedback history
 * @access  Private
 */
router.get('/my-feedback', isAuthenticated, isActive, getMyFeedback);

/**
 * @route   GET /api/users/my-interactions
 * @desc    Get user's interactions with sellers
 * @access  Private
 */
router.get('/my-interactions', isAuthenticated, isActive, getMyInteractions);

export default router;

