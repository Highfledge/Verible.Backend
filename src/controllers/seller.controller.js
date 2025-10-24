import Seller from '../models/Seller.model.js';
import User from '../models/User.model.js';
import profileExtractionService from '../services/profileExtraction.service.js';
import pulseScoringService from '../services/pulseScoring.service.js';
import { validationResult } from 'express-validator';

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
      pulseScore: scoringResult?.pulseScore || 50,
      confidenceLevel: scoringResult?.confidenceLevel || 'low',
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
      .select('pulseScore confidenceLevel lastScored verificationStatus totalFlags totalEndorsements netFeedbackScore');

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

    const sellers = await Seller.find(query)
      .sort({ pulseScore: -1, lastScored: -1 })
      .limit(parseInt(limit))
      .populate('userId', 'name email role verified')
      .select('-flags -endorsements -scoringFactors');

    res.status(200).json({
      success: true,
      data: {
        sellers: sellers.map(seller => seller.toJSON()),
        count: sellers.length
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
