import express from 'express';
import { body } from 'express-validator';
import {
  register,
  login,
  verifyUser,
  sendVerificationCode,
  resendVerificationCode,
  getCurrentUser,
  refreshToken,
  forgotPassword,
  resetPassword
} from '../controllers/auth.controller.js';
import { isAuthenticated } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post(
  '/register',
  [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Name is required')
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters'),
    body('email')
      .trim()
      .notEmpty()
      .withMessage('Email is required')
      .isEmail()
      .withMessage('Please provide a valid email')
      .toLowerCase(),
    body('phone')
      .trim()
      .notEmpty()
      .withMessage('Phone is required')
      .matches(/^\+?[1-9]\d{1,14}$/)
      .withMessage('Please provide a valid phone number'),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long'),
    body('role')
      .optional()
      .isIn(['user', 'seller', 'admin'])
      .withMessage('Role must be user, seller, or admin'),
    body('verificationMethod')
      .optional()
      .isIn(['email', 'phone'])
      .withMessage('Verification method must be email or phone')
  ],
  register
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post(
  '/login',
  [
    body('emailOrPhone')
      .trim()
      .notEmpty()
      .withMessage('Email or phone is required'),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
  ],
  login
);




/**
 * @route   POST /api/auth/verify/resend
 * @desc    Resend verification code (public - no auth required)
 * @access  Public
 */
router.post(
  '/verify/resend',
  [
    body('emailOrPhone')
      .trim()
      .notEmpty()
      .withMessage('Email or phone number is required'),
    body('method')
      .notEmpty()
      .withMessage('Verification method is required')
      .isIn(['email', 'phone'])
      .withMessage('Method must be email or phone')
  ],
  resendVerificationCode
);

/**
 * @route   POST /api/auth/verify
 * @desc    Verify user with code (PUBLIC - no auth required)
 * @access  Public
 */
router.post(
  '/verify',
  [
    body('emailOrPhone')
      .trim()
      .notEmpty()
      .withMessage('Email or phone is required'),
    body('code')
      .trim()
      .notEmpty()
      .withMessage('Verification code is required')
      .isLength({ min: 6, max: 6 })
      .withMessage('Code must be 6 digits')
  ],
  verifyUser
);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private (requires authentication)
 */
router.get('/me', isAuthenticated, getCurrentUser);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh user token
 * @access  Private (requires authentication)
 */
router.post('/refresh', isAuthenticated, refreshToken);

/**
 * @route   POST /api/auth/password/forgot
 * @desc    Request password reset (send reset code)
 * @access  Public (verified users only)
 */
router.post(
  '/password/forgot',
  [
    body('emailOrPhone')
      .trim()
      .notEmpty()
      .withMessage('Email or phone is required'),
    body('method')
      .notEmpty()
      .withMessage('Method is required')
      .isIn(['email', 'phone'])
      .withMessage('Method must be email or phone')
  ],
  forgotPassword
);

/**
 * @route   POST /api/auth/password/reset
 * @desc    Reset password with code
 * @access  Public (verified users only)
 */
router.post(
  '/password/reset',
  [
    body('emailOrPhone')
      .trim()
      .notEmpty()
      .withMessage('Email or phone is required'),
    body('resetToken')
      .trim()
      .notEmpty()
      .withMessage('Reset code is required')
      .isLength({ min: 6, max: 6 })
      .withMessage('Reset code must be 6 digits'),
    body('newPassword')
      .notEmpty()
      .withMessage('New password is required')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long')
  ],
  resetPassword
);

export default router;

