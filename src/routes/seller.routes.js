import express from 'express';
import { body, param } from 'express-validator';
import { isAuthenticated, isActive, optionalAuth } from '../middleware/auth.middleware.js';
import {
  becomeSeller,
  generateVerificationCode,
  verifyProfile,
  getMySellerProfile,
  deleteSellerAccount,
  updateSellerProfile,
  lookupSeller,
  getSellerById,
  getSellerScore,
  getTopSellers,
  claimSellerProfile,
  flagSeller,
  endorseSeller,
  removeFlag,
  removeEndorsement,
  getSellerFeedback,
  searchSellers,
  getSellerAnalytics,
  getAllSellers
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
    .isIn(['facebook', 'jiji', 'jumia', 'konga', 'etsy', 'kijiji', 'other'])
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

const flagEndorseValidation = [
  body('reason')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Reason must be between 1 and 200 characters')
];

const claimSellerValidation = [
  body('sellerId')
    .notEmpty()
    .withMessage('Seller ID is required'),
  body('platform')
    .isIn(['facebook', 'jiji', 'jumia', 'konga', 'etsy', 'kijiji', 'other'])
    .withMessage('Platform must be facebook, jiji, or other'),
  body('profileUrl')
    .isURL()
    .withMessage('Profile URL must be a valid URL')
];

const updateProfileValidation = [
  body('profileData')
    .optional()
    .isObject()
    .withMessage('Profile data must be an object')
];

// Routes

/**
 * @route   POST /api/sellers/extract-profile
 * @desc    Extract Seller Profile From Url
 * @access  Public (optional auth - tracks extraction if authenticated)
 */
router.post('/extract-profile', optionalAuth, profileUrlValidation, extractAndScoreProfile);

/**
 * @route   POST /api/sellers/score-by-url
 * @desc    Extract Seller Profile From Url - Not Saved
 * @access  Public
 */
router.post('/score-by-url', profileUrlValidation, scoreProfileByUrl);

/**
 * @route   POST /api/sellers/generate-verification-code
 * @desc    Generate verification code for profile URL
 * @access  Private (User must be authenticated)
 */
router.post('/generate-verification-code', isAuthenticated, isActive, profileUrlValidation, generateVerificationCode);

/**
 * @route   POST /api/sellers/verify-profile
 * @desc    Verify profile by checking verification code in bio
 * @access  Private (User must be authenticated)
 */
router.post('/verify-profile', isAuthenticated, isActive, profileUrlValidation, verifyProfile);

/**
 * @route   POST /api/sellers/become-seller
 * @desc    Become Seller (requires verified profile)
 * @access  Private (User must be authenticated)
 */
router.post('/become-seller', isAuthenticated, isActive, becomeSellerValidation, becomeSeller);

/**
 * @route   GET /api/sellers/my-profile
 * @desc    Get My Seller Profile
 * @access  Private (User must be authenticated)
 */
router.get('/my-profile', isAuthenticated, isActive, getMySellerProfile);

/**
 * @route   DELETE /api/sellers/account
 * @desc    Delete Seller Account
 * @access  Private (User must be authenticated)
 */
router.delete('/account', isAuthenticated, isActive, deleteSellerAccount);

/**
 * @route   POST /api/sellers/:id/recalculate-score
 * @desc    Recalculate My Seller Score
 * @access  Public
 */
router.post('/:id/recalculate-score', sellerIdValidation, recalculateSellerScore);

/**
 * @route   PUT /api/sellers/profile
 * @desc    Update seller profile
 * @access  Private
 */
router.put('/profile', isAuthenticated, isActive, updateProfileValidation, updateSellerProfile);

/**
 * @route   GET /api/sellers/lookup
 * @desc    Lookup seller by URL or name
 * @access  Public
 */
router.get('/lookup', lookupSeller);

/**
 * @route   GET /api/sellers/top
 * @desc    Get top sellers by pulse score
 * @access  Public
 */
router.get('/top', getTopSellers);

/**
 * @route   GET /api/sellers/search
 * @desc    Search sellers
 * @access  Public
 */
router.get('/search', searchSellers);

/**
 * @route   GET /api/sellers/all
 * @desc    Get all sellers (for debugging)
 * @access  Public
 */
router.get('/all', getAllSellers);

/**
 * @route   GET /api/sellers/:id
 * @desc    Get seller by ID
 * @access  Public
 */
router.get('/:id', sellerIdValidation, getSellerById);

/**
 * @route   GET /api/sellers/:id/score
 * @desc    Get seller pulse score
 * @access  Public
 */
router.get('/:id/score', sellerIdValidation, getSellerScore);

/**
 * @route   POST /api/sellers/claim
 * @desc    Claim existing seller profile
 * @access  Private
 */
router.post('/claim', isAuthenticated, isActive, claimSellerValidation, claimSellerProfile);

/**
 * @route   POST /api/sellers/:id/flag
 * @desc    Flag a seller
 * @access  Private
 */
router.post('/:id/flag', isAuthenticated, isActive, sellerIdValidation, flagEndorseValidation, flagSeller);

/**
 * @route   POST /api/sellers/:id/endorse
 * @desc    Endorse a seller
 * @access  Private
 */
router.post('/:id/endorse', isAuthenticated, isActive, sellerIdValidation, flagEndorseValidation, endorseSeller);

/**
 * @route   DELETE /api/sellers/:id/flag
 * @desc    Remove flag from seller
 * @access  Private
 */
router.delete('/:id/flag', isAuthenticated, isActive, sellerIdValidation, removeFlag);

/**
 * @route   DELETE /api/sellers/:id/endorse
 * @desc    Remove endorsement from seller
 * @access  Private
 */
router.delete('/:id/endorse', isAuthenticated, isActive, sellerIdValidation, removeEndorsement);

/**
 * @route   GET /api/sellers/:id/feedback
 * @desc    Get seller feedback (flags and endorsements)
 * @access  Public
 */
router.get('/:id/feedback', sellerIdValidation, getSellerFeedback);

/**
 * @route   GET /api/sellers/:id/analytics
 * @desc    Get seller analytics
 * @access  Public
 */
router.get('/:id/analytics', sellerIdValidation, getSellerAnalytics);

export default router;