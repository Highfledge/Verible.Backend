import express from 'express';
import { body, param } from 'express-validator';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import {
  becomeSeller,
  getMySellerProfile,
  deleteSellerAccount
} from '../controllers/seller.controller.js';
import {
  extractAndScoreProfile,
  scoreProfileByUrl,
  recalculateSellerScore
} from '../controllers/profileExtraction.controller.js';

const router = express.Router();

// Validation rules
const becomeSellerValidation = [
  body('platform')
    .isIn(['facebook', 'jiji', 'other'])
    .withMessage('Platform must be facebook, jiji, or other'),
  body('profileUrl')
    .isURL()
    .withMessage('Profile URL must be a valid URL'),
  body('sellerId')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Seller ID must be between 1 and 100 characters')
];

const profileUrlValidation = [
  body('profileUrl')
    .isURL()
    .withMessage('Profile URL must be a valid URL')
];

const sellerIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid seller ID format')
];

// Routes

/**
 * @route   POST /api/sellers/extract-profile
 * @desc    Extract Seller Profile From Url
 * @access  Public
 */
router.post('/extract-profile', profileUrlValidation, extractAndScoreProfile);

/**
 * @route   POST /api/sellers/score-by-url
 * @desc    Extract Seller Profile From Url - Not Saved
 * @access  Public
 */
router.post('/score-by-url', profileUrlValidation, scoreProfileByUrl);

/**
 * @route   POST /api/sellers/become-seller
 * @desc    Become Seller
 * @access  Private (User must be authenticated)
 */
router.post('/become-seller', isAuthenticated, becomeSellerValidation, becomeSeller);

/**
 * @route   GET /api/sellers/my-profile
 * @desc    Get My Seller Profile
 * @access  Private (User must be authenticated)
 */
router.get('/my-profile', isAuthenticated, getMySellerProfile);

/**
 * @route   DELETE /api/sellers/account
 * @desc    Delete Seller Account
 * @access  Private (User must be authenticated)
 */
router.delete('/account', isAuthenticated, deleteSellerAccount);

/**
 * @route   POST /api/sellers/:id/recalculate-score
 * @desc    Recalculate My Seller Score
 * @access  Public
 */
router.post('/:id/recalculate-score', sellerIdValidation, recalculateSellerScore);

export default router;