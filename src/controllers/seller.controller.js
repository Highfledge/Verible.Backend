import Seller from '../models/Seller.model.js';
import User from '../models/User.model.js';
import profileExtractionService from '../services/profileExtraction.service.js';
import pulseScoringService from '../services/pulseScoring.service.js';
import { validationResult } from 'express-validator';

/**
 * Helper function to get confidence level from pulse score
 * Returns values matching the Seller model enum: 'Very Low', 'Low', 'Medium', 'High', 'Very High'
 */
const getConfidenceLevelFromScore = (pulseScore) => {
  if (pulseScore >= 80) return 'Very High';
  if (pulseScore >= 60) return 'High';
  if (pulseScore >= 40) return 'Medium';
  if (pulseScore >= 20) return 'Low';
  return 'Very Low';
};

/**
 * Helper function to normalize confidence level to valid enum value
 * Handles legacy lowercase values and converts them to proper format
 */
const normalizeConfidenceLevel = (confidenceLevel) => {
  if (!confidenceLevel) return 'Low';
  
  const normalized = confidenceLevel.toString().trim();
  
  // Map lowercase/incorrect values to correct enum values
  const mapping = {
    'very low': 'Very Low',
    'low': 'Low',
    'medium': 'Medium',
    'high': 'High',
    'very high': 'Very High'
  };
  
  return mapping[normalized.toLowerCase()] || normalized;
};

/**
 * Create seller profile from existing user account
 * POST /api/sellers/become-seller
 */
export const becomeSeller = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { platform, profileUrl, sellerId } = req.body;
    const userId = req.user._id;

    // Check if user is already a seller
    const existingSeller = await Seller.findOne({ userId });
    if (existingSeller) {
      return res.status(400).json({
        success: false,
        message: 'User is already a seller'
      });
    }

    // Check if sellerId already exists on this platform
    const existingSellerId = await Seller.findOne({ 
      platform, 
      sellerId: sellerId || 'temp-' + Date.now() 
    });
    if (existingSellerId) {
      return res.status(400).json({
        success: false,
        message: 'Seller ID already exists on this platform'
      });
    }

    // Update user role to seller
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.role = 'seller';
    await user.save();

    // Extract data from profile URL
    let extractedData = null;
    let scoringResult = null;
    
    try {
      console.log('🔍 Extracting data from profile URL...');
      extractedData = await profileExtractionService.extractProfile(profileUrl);
      
      // Calculate pulse score with extracted data
      scoringResult = await pulseScoringService.calculatePulseScore(
        extractedData,
        extractedData.recentListings || []
      );
      
      console.log('✅ Profile extraction and scoring completed');
    } catch (error) {
      console.log('⚠️ Profile extraction failed, using basic data:', error.message);
    }

    // Create seller profile with extracted data or fallback to user data
    const seller = new Seller({
      userId,
      sellerId: sellerId || `user-${userId}-${Date.now()}`,
      platform,
      profileUrl,
      profileData: extractedData?.profileData || {
        name: user.name,
        location: 'Not specified'
      },
      marketplaceData: extractedData?.marketplaceData || {},
      recentListings: extractedData?.recentListings || [],
      trustIndicators: extractedData?.trustIndicators || {},
      pulseScore: scoringResult?.pulseScore || 50,
      confidenceLevel: scoringResult?.confidenceLevel || 'Low',
      lastScored: new Date(),
      scoringFactors: scoringResult?.scoringFactors || {},
      isClaimed: true,
      claimedAt: new Date(),
      verificationStatus: extractedData?.marketplaceData?.verificationStatus || 
                         (user.verified ? 'email-verified' : 'unverified')
    });

    await seller.save();

    // Populate user data
    await seller.populate('userId', 'name email phone role');

    res.status(201).json({
      success: true,
      message: 'Successfully became a seller',
      data: {
        seller: seller.toJSON(),
        user: user.toJSON(),
        extractedData: extractedData,
        scoringResult: scoringResult ? {
          pulseScore: scoringResult.pulseScore,
          confidenceLevel: scoringResult.confidenceLevel,
          recommendations: scoringResult.recommendations,
          trustIndicators: scoringResult.trustIndicators,
          riskFactors: scoringResult.riskFactors
        } : null
      }
    });
  } catch (error) {
    console.error('Become seller error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to become seller',
      error: error.message
    });
  }
};

/**
 * Get seller profile by user
 * GET /api/sellers/my-profile
 */
export const getMySellerProfile = async (req, res) => {
  try {
    const userId = req.user._id;

    const seller = await Seller.findOne({ userId })
      .populate('userId', 'name email phone role verified')
      .populate('listingHistory', 'title price category listingDate isActive')
      .select('-flags -endorsements -scoringFactors');

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller profile not found. You need to become a seller first.'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        seller: seller.toJSON()
      }
    });
  } catch (error) {
    console.error('Get seller profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get seller profile',
      error: error.message
    });
  }
};

/**
 * Lookup seller by URL or name
 * GET /api/sellers/lookup
 */
export const lookupSeller = async (req, res) => {
  try {
    const { url, name, platform } = req.query;

    if (!url && !name) {
      return res.status(400).json({
        success: false,
        message: 'URL or name is required for lookup'
      });
    }

    let seller;

    if (url) {
      // Lookup by profile URL
      seller = await Seller.findOne({ profileUrl: url })
        .populate('userId', 'name email role verified')
        .select('-flags -endorsements -scoringFactors');
    } else if (name && platform) {
      // Lookup by name and platform
      seller = await Seller.findOne({ 
        'profileData.name': { $regex: name, $options: 'i' },
        platform 
      })
        .populate('userId', 'name email role verified')
        .select('-flags -endorsements -scoringFactors');
    }

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        seller: seller.toJSON()
      }
    });
  } catch (error) {
    console.error('Lookup seller error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to lookup seller',
      error: error.message
    });
  }
};

/**
 * Get seller by ID
 * GET /api/sellers/:id
 */
export const getSellerById = async (req, res) => {
  try {
    const { id } = req.params;

    const seller = await Seller.findById(id)
      .populate('userId', 'name email role verified')
      .populate('listingHistory', 'title price category listingDate isActive')
      .select('-flags -endorsements -scoringFactors');

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        seller: seller.toJSON()
      }
    });
  } catch (error) {
    console.error('Get seller by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get seller',
      error: error.message
    });
  }
};

/**
 * Get seller pulse score
 * GET /api/sellers/:id/score
 */
export const getSellerScore = async (req, res) => {
  try {
    const { id } = req.params;

    const seller = await Seller.findById(id)
      .select('pulseScore confidenceLevel lastScored verificationStatus flags endorsements');

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        score: {
          pulseScore: seller.pulseScore,
          confidenceLevel: seller.confidenceLevel,
          lastScored: seller.lastScored,
          verificationStatus: seller.verificationStatus,
          totalFlags: seller.totalFlags,
          totalEndorsements: seller.totalEndorsements,
          netFeedbackScore: seller.netFeedbackScore
        }
      }
    });
  } catch (error) {
    console.error('Get seller score error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get seller score',
      error: error.message
    });
  }
};

/**
 * Claim seller profile (for existing sellers to claim their profile)
 * POST /api/sellers/claim
 */
export const claimSellerProfile = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { sellerId, platform, profileUrl } = req.body;
    const userId = req.user._id;

    // Check if user is already a seller
    const existingSeller = await Seller.findOne({ userId });
    if (existingSeller) {
      return res.status(400).json({
        success: false,
        message: 'User already has a seller profile'
      });
    }

    // Find existing seller by platform and sellerId
    const seller = await Seller.findOne({ 
      platform, 
      sellerId,
      isClaimed: false 
    });

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller profile not found or already claimed'
      });
    }

    // Claim the seller profile
    seller.userId = userId;
    seller.isClaimed = true;
    seller.claimedAt = new Date();
    await seller.save();

    // Update user role to seller
    const user = await User.findById(userId);
    user.role = 'seller';
    await user.save();

    await seller.populate('userId', 'name email phone role verified');

    res.status(200).json({
      success: true,
      message: 'Seller profile claimed successfully',
      data: {
        seller: seller.toJSON()
      }
    });
  } catch (error) {
    console.error('Claim seller profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to claim seller profile',
      error: error.message
    });
  }
};

/**
 * Get top sellers by pulse score
 * GET /api/sellers/top
 */
export const getTopSellers = async (req, res) => {
  try {
    const { limit = 10, platform } = req.query;

    const query = { isActive: true };
    if (platform) {
      query.platform = platform;
    }

    // Get total count for debugging
    const totalSellers = await Seller.countDocuments(query);
    console.log(`Total active sellers: ${totalSellers}`);

    const sellers = await Seller.find(query)
      .sort({ pulseScore: -1, lastScored: -1 })
      .limit(parseInt(limit))
      .populate('userId', 'name email role verified')
      .select('-flags -endorsements -scoringFactors');

    console.log(`Found ${sellers.length} sellers for top sellers query`);
    console.log('Query:', query);
    console.log('Limit:', limit);

    res.status(200).json({
      success: true,
      data: {
        sellers: sellers.map(seller => seller.toJSON()),
        count: sellers.length,
        total: totalSellers,
        query: query,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get top sellers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get top sellers',
      error: error.message
    });
  }
};

/**
 * Delete seller account
 * DELETE /api/sellers/account
 */
export const deleteSellerAccount = async (req, res) => {
  try {
    const userId = req.user._id;

    // Find seller by user ID
    const seller = await Seller.findOne({ userId });
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller account not found'
      });
    }

    // Delete the seller record
    await Seller.findByIdAndDelete(seller._id);

    // Update user role back to 'user'
    const user = await User.findById(userId);
    if (user) {
      user.role = 'user';
      await user.save();
    }

    res.status(200).json({
      success: true,
      message: 'Seller account deleted successfully'
    });
  } catch (error) {
    console.error('Delete seller account error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete seller account',
      error: error.message
    });
  }
};

/**
 * Flag a seller
 * POST /api/sellers/:id/flag
 */
export const flagSeller = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user._id;

    const seller = await Seller.findById(id);
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller not found'
      });
    }

    // Normalize confidenceLevel if it has an invalid value and save it
    // This ensures the document is valid before addFlag() calls save()
    if (seller.confidenceLevel) {
      const normalized = normalizeConfidenceLevel(seller.confidenceLevel);
      if (normalized !== seller.confidenceLevel) {
        seller.confidenceLevel = normalized;
        await seller.save();
      }
    }

    // Check if user can interact with this seller
    if (!seller.canUserInteract(userId)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot flag your own seller profile'
      });
    }

    // Check if user already flagged this seller
    const existingFlag = seller.flags.find(flag => flag.userId.toString() === userId.toString());
    if (existingFlag) {
      return res.status(400).json({
        success: false,
        message: 'You have already flagged this seller'
      });
    }

    await seller.addFlag(userId, reason);

    // Recalculate pulse score after adding flag
    const updatedSeller = await Seller.findById(id);
    // Normalize confidenceLevel if it has an invalid value
    if (updatedSeller.confidenceLevel) {
      updatedSeller.confidenceLevel = normalizeConfidenceLevel(updatedSeller.confidenceLevel);
    }
    const newPulseScore = Math.max(0, updatedSeller.pulseScore - 5); // Reduce score by 5 points
    const newConfidenceLevel = getConfidenceLevelFromScore(newPulseScore);
    
    updatedSeller.pulseScore = newPulseScore;
    updatedSeller.confidenceLevel = newConfidenceLevel;
    updatedSeller.lastScored = new Date();
    await updatedSeller.save();

    // Refresh the seller to get updated virtual fields
    const refreshedSeller = await Seller.findById(id);

    res.status(200).json({
      success: true,
      message: 'Seller flagged successfully',
      data: {
        newPulseScore,
        newConfidenceLevel,
        totalFlags: refreshedSeller.totalFlags,
        netFeedbackScore: refreshedSeller.netFeedbackScore
      }
    });
  } catch (error) {
    console.error('Flag seller error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to flag seller',
      error: error.message
    });
  }
};

/**
 * Endorse a seller
 * POST /api/sellers/:id/endorse
 */
export const endorseSeller = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user._id;

    const seller = await Seller.findById(id);
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller not found'
      });
    }

    // Normalize confidenceLevel if it has an invalid value and save it
    // This ensures the document is valid before addEndorsement() calls save()
    if (seller.confidenceLevel) {
      const normalized = normalizeConfidenceLevel(seller.confidenceLevel);
      if (normalized !== seller.confidenceLevel) {
        seller.confidenceLevel = normalized;
        await seller.save();
      }
    }

    // Check if user can interact with this seller
    if (!seller.canUserInteract(userId)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot endorse your own seller profile'
      });
    }

    // Check if user already endorsed this seller
    const existingEndorsement = seller.endorsements.find(endorsement => endorsement.userId.toString() === userId.toString());
    if (existingEndorsement) {
      return res.status(400).json({
        success: false,
        message: 'You have already endorsed this seller'
      });
    }

    await seller.addEndorsement(userId, reason);

    // Recalculate pulse score after adding endorsement
    const updatedSeller = await Seller.findById(id);
    // Normalize confidenceLevel if it has an invalid value
    if (updatedSeller.confidenceLevel) {
      updatedSeller.confidenceLevel = normalizeConfidenceLevel(updatedSeller.confidenceLevel);
    }
    const newPulseScore = Math.min(100, updatedSeller.pulseScore + 3); // Increase score by 3 points
    const newConfidenceLevel = getConfidenceLevelFromScore(newPulseScore);
    
    updatedSeller.pulseScore = newPulseScore;
    updatedSeller.confidenceLevel = newConfidenceLevel;
    updatedSeller.lastScored = new Date();
    await updatedSeller.save();

    // Refresh the seller to get updated virtual fields
    const refreshedSeller = await Seller.findById(id);

    res.status(200).json({
      success: true,
      message: 'Seller endorsed successfully',
      data: {
        newPulseScore,
        newConfidenceLevel,
        totalEndorsements: refreshedSeller.totalEndorsements,
        netFeedbackScore: refreshedSeller.netFeedbackScore
      }
    });
  } catch (error) {
    console.error('Endorse seller error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to endorse seller',
      error: error.message
    });
  }
};

/**
 * Remove flag from seller
 * DELETE /api/sellers/:id/flag
 */
export const removeFlag = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const seller = await Seller.findById(id);
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller not found'
      });
    }

    // Normalize confidenceLevel if it has an invalid value
    if (seller.confidenceLevel) {
      seller.confidenceLevel = normalizeConfidenceLevel(seller.confidenceLevel);
    }

    // Find and remove the flag
    const flagIndex = seller.flags.findIndex(flag => flag.userId.toString() === userId.toString());
    if (flagIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Flag not found'
      });
    }

    seller.flags.splice(flagIndex, 1);
    await seller.save();

    // Recalculate pulse score after removing flag
    const newPulseScore = Math.min(100, seller.pulseScore + 5); // Restore score by 5 points
    const newConfidenceLevel = getConfidenceLevelFromScore(newPulseScore);
    
    seller.pulseScore = newPulseScore;
    seller.confidenceLevel = newConfidenceLevel;
    seller.lastScored = new Date();
    await seller.save();

    res.status(200).json({
      success: true,
      message: 'Flag removed successfully',
      data: {
        newPulseScore,
        newConfidenceLevel,
        totalFlags: seller.totalFlags,
        netFeedbackScore: seller.netFeedbackScore
      }
    });
  } catch (error) {
    console.error('Remove flag error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove flag',
      error: error.message
    });
  }
};

/**
 * Remove endorsement from seller
 * DELETE /api/sellers/:id/endorse
 */
export const removeEndorsement = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const seller = await Seller.findById(id);
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller not found'
      });
    }

    // Normalize confidenceLevel if it has an invalid value
    if (seller.confidenceLevel) {
      seller.confidenceLevel = normalizeConfidenceLevel(seller.confidenceLevel);
    }

    // Find and remove the endorsement
    const endorsementIndex = seller.endorsements.findIndex(endorsement => endorsement.userId.toString() === userId.toString());
    if (endorsementIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Endorsement not found'
      });
    }

    seller.endorsements.splice(endorsementIndex, 1);
    await seller.save();

    // Recalculate pulse score after removing endorsement
    const newPulseScore = Math.max(0, seller.pulseScore - 3); // Reduce score by 3 points
    const newConfidenceLevel = getConfidenceLevelFromScore(newPulseScore);
    
    seller.pulseScore = newPulseScore;
    seller.confidenceLevel = newConfidenceLevel;
    seller.lastScored = new Date();
    await seller.save();

    res.status(200).json({
      success: true,
      message: 'Endorsement removed successfully',
      data: {
        newPulseScore,
        newConfidenceLevel,
        totalEndorsements: seller.totalEndorsements,
        netFeedbackScore: seller.netFeedbackScore
      }
    });
  } catch (error) {
    console.error('Remove endorsement error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove endorsement',
      error: error.message
    });
  }
};

/**
 * Get seller feedback (flags and endorsements)
 * GET /api/sellers/:id/feedback
 */
export const getSellerFeedback = async (req, res) => {
  try {
    const { id } = req.params;

    const seller = await Seller.findById(id)
      .populate('flags.userId', 'name email')
      .populate('endorsements.userId', 'name email')
      .select('flags endorsements totalFlags totalEndorsements netFeedbackScore');

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        flags: seller.flags,
        endorsements: seller.endorsements,
        totalFlags: seller.totalFlags,
        totalEndorsements: seller.totalEndorsements,
        netFeedbackScore: seller.netFeedbackScore
      }
    });
  } catch (error) {
    console.error('Get seller feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get seller feedback',
      error: error.message
    });
  }
};

/**
 * Search sellers
 * GET /api/sellers/search
 */
export const searchSellers = async (req, res) => {
  try {
    const { name, platform, location, limit = 20, page = 1 } = req.query;

    const query = { isActive: true };
    
    if (name) {
      query['profileData.name'] = { $regex: name, $options: 'i' };
    }
    
    if (platform) {
      query.platform = platform;
    }
    
    if (location) {
      query['profileData.location'] = { $regex: location, $options: 'i' };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const sellers = await Seller.find(query)
      .populate('userId', 'name email role verified')
      .select('-flags -endorsements -scoringFactors')
      .sort({ pulseScore: -1, lastScored: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Seller.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        sellers: sellers.map(seller => seller.toJSON()),
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalSellers: total,
          hasNext: skip + parseInt(limit) < total,
          hasPrev: parseInt(page) > 1
        }
      }
    });
  } catch (error) {
    console.error('Search sellers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search sellers',
      error: error.message
    });
  }
};

/**
 * Get all sellers (for debugging)
 * GET /api/sellers/debug/all
 */
export const getAllSellersDebug = async (req, res) => {
  try {
    const { platform, limit = 50 } = req.query;

    const query = {};
    if (platform) {
      query.platform = platform;
    }

    const sellers = await Seller.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('userId', 'name email role verified')
      .select('sellerId platform profileData.name pulseScore isActive isClaimed createdAt');

    const stats = {
      total: await Seller.countDocuments(),
      active: await Seller.countDocuments({ isActive: true }),
      claimed: await Seller.countDocuments({ isClaimed: true }),
      extracted: await Seller.countDocuments({ userId: null }),
      byPlatform: await Seller.aggregate([
        { $group: { _id: '$platform', count: { $sum: 1 } } }
      ])
    };

    res.status(200).json({
      success: true,
      data: {
        sellers: sellers.map(seller => seller.toJSON()),
        stats,
        query,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get all sellers debug error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get all sellers',
      error: error.message
    });
  }
};

/**
 * Get all sellers (for debugging)
 * GET /api/sellers/all
 */
export const getAllSellers = async (req, res) => {
  try {
    const { limit = 100, platform, includeInactive = false } = req.query;

    const query = {};
    
    if (!includeInactive) {
      query.isActive = true;
    }
    
    if (platform) {
      query.platform = platform;
    }

    const sellers = await Seller.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('userId', 'name email role verified')
      .select('-flags -endorsements -scoringFactors');

    const totalCount = await Seller.countDocuments(query);
    const activeCount = await Seller.countDocuments({ isActive: true });
    const inactiveCount = await Seller.countDocuments({ isActive: false });
    const claimedCount = await Seller.countDocuments({ isClaimed: true });
    const extractedCount = await Seller.countDocuments({ userId: null });

    res.status(200).json({
      success: true,
      data: {
        sellers: sellers.map(seller => seller.toJSON()),
        count: sellers.length,
        total: totalCount,
        stats: {
          active: activeCount,
          inactive: inactiveCount,
          claimed: claimedCount,
          extracted: extractedCount
        },
        query: query,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get all sellers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get all sellers',
      error: error.message
    });
  }
};

/**
 * Get seller analytics
 * GET /api/sellers/:id/analytics
 */
export const getSellerAnalytics = async (req, res) => {
  try {
    const { id } = req.params;

    const seller = await Seller.findById(id)
      .populate('listingHistory', 'title price category listingDate isActive')
      .select('pulseScore confidenceLevel totalFlags totalEndorsements netFeedbackScore lastScored verificationStatus listingHistory');

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller not found'
      });
    }

    // Calculate analytics
    const totalListings = seller.listingHistory.length;
    const activeListings = seller.listingHistory.filter(listing => listing.isActive).length;
    const averagePrice = totalListings > 0 
      ? seller.listingHistory.reduce((sum, listing) => sum + listing.price, 0) / totalListings 
      : 0;

    const analytics = {
      seller: {
        id: seller._id,
        pulseScore: seller.pulseScore,
        confidenceLevel: seller.confidenceLevel,
        verificationStatus: seller.verificationStatus,
        lastScored: seller.lastScored
      },
      feedback: {
        totalFlags: seller.totalFlags,
        totalEndorsements: seller.totalEndorsements,
        netFeedbackScore: seller.netFeedbackScore
      },
      listings: {
        total: totalListings,
        active: activeListings,
        inactive: totalListings - activeListings,
        averagePrice: Math.round(averagePrice)
      },
      trustLevel: seller.pulseScore >= 80 ? 'High' : seller.pulseScore >= 60 ? 'Medium' : seller.pulseScore >= 40 ? 'Low' : 'Very Low'
    };

    res.status(200).json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Get seller analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get seller analytics',
      error: error.message
    });
  }
};

/**
 * Update seller profile
 * PUT /api/sellers/profile
 */
export const updateSellerProfile = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { profileData } = req.body;
    const userId = req.user._id;

    const seller = await Seller.findOne({ userId });
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller profile not found'
      });
    }

    // Update profile data
    if (profileData) {
      seller.profileData = { ...seller.profileData, ...profileData };
    }

    await seller.save();

    res.status(200).json({
      success: true,
      message: 'Seller profile updated successfully',
      data: {
        seller: seller.toJSON()
      }
    });
  } catch (error) {
    console.error('Update seller profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update seller profile',
      error: error.message
    });
  }
};
