import Seller from '../models/Seller.model.js';
import profileExtractionService from '../services/profileExtraction.service.js';
import pulseScoringService from '../services/pulseScoring.service.js';
import { validationResult } from 'express-validator';

/**
 * Extract and score seller profile from URL
 * POST /api/sellers/extract-profile
 */
export const extractAndScoreProfile = async (req, res) => {
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

    const { profileUrl } = req.body;

    // Extract profile data
    const extractedData = await profileExtractionService.extractProfile(profileUrl);
    
    // Calculate pulse score
    const scoringResult = await pulseScoringService.calculatePulseScore(
      extractedData,
      extractedData.recentListings || []
    );

    // Check if seller already exists by profileUrl
    let seller = await Seller.findOne({ profileUrl });
    
    if (seller) {
      // Update existing seller with new data
      seller.profileData = extractedData.profileData;
      seller.pulseScore = scoringResult.pulseScore;
      seller.confidenceLevel = scoringResult.confidenceLevel;
      seller.lastScored = new Date();
      seller.scoringFactors = scoringResult.scoringFactors;
      await seller.save();
    } else {
      // Try multiple strategies to create/update seller
      let sellerCreated = false;
      let attempts = 0;
      const maxAttempts = 3;

      while (!sellerCreated && attempts < maxAttempts) {
        try {
          attempts++;
          console.log(`Attempt ${attempts} to create seller...`);
          
          // Create new seller record (no userId for extracted profiles)
          seller = new Seller({
            userId: null, // Explicitly set to null for extracted profiles
            sellerId: `extracted-${Date.now()}-${attempts}`,
            platform: extractedData.platform,
            profileUrl,
            profileData: extractedData.profileData,
            pulseScore: scoringResult.pulseScore,
            confidenceLevel: scoringResult.confidenceLevel,
            lastScored: new Date(),
            scoringFactors: scoringResult.scoringFactors,
            isActive: true,
            isClaimed: false // Not claimed by any user yet
          });
          await seller.save();
          sellerCreated = true;
          console.log('Seller created successfully');
        } catch (error) {
          if (error.code === 11000) {
            console.log(`Duplicate key error on attempt ${attempts}, trying different approach...`);
            
            // Try to find existing seller by profileUrl
            seller = await Seller.findOne({ profileUrl });
            if (seller) {
              console.log('Found existing seller, updating...');
              seller.profileData = extractedData.profileData;
              seller.pulseScore = scoringResult.pulseScore;
              seller.confidenceLevel = scoringResult.confidenceLevel;
              seller.lastScored = new Date();
              seller.scoringFactors = scoringResult.scoringFactors;
              await seller.save();
              sellerCreated = true;
            } else if (attempts < maxAttempts) {
              // Try with a different sellerId
              console.log(`Trying with different sellerId on attempt ${attempts + 1}...`);
              continue;
            } else {
              // Last attempt failed, try to find any seller with this profileUrl
              console.log('All attempts failed, trying to find any existing seller...');
              seller = await Seller.findOne({ 
                $or: [
                  { profileUrl },
                  { 'profileData.name': extractedData.profileData.name },
                  { platform: extractedData.platform, sellerId: { $regex: 'extracted-' } }
                ]
              });
              
              if (seller) {
                console.log('Found similar seller, updating...');
                seller.profileData = extractedData.profileData;
                seller.pulseScore = scoringResult.pulseScore;
                seller.confidenceLevel = scoringResult.confidenceLevel;
                seller.lastScored = new Date();
                seller.scoringFactors = scoringResult.scoringFactors;
                await seller.save();
                sellerCreated = true;
              } else {
                console.log('No existing seller found, creating with unique ID...');
                // Create with a completely unique ID
                seller = new Seller({
                  userId: null,
                  sellerId: `extracted-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${attempts}`,
                  platform: extractedData.platform,
                  profileUrl,
                  profileData: extractedData.profileData,
                  pulseScore: scoringResult.pulseScore,
                  confidenceLevel: scoringResult.confidenceLevel,
                  lastScored: new Date(),
                  scoringFactors: scoringResult.scoringFactors,
                  isActive: true,
                  isClaimed: false
                });
                await seller.save();
                sellerCreated = true;
              }
            }
          } else {
            console.error('Non-duplicate error:', error);
            throw error;
          }
        }
      }

      if (!sellerCreated) {
        throw new Error('Failed to create or find seller after multiple attempts');
      }
    }

    // Ensure seller exists before proceeding
    if (!seller) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create or find seller record',
        error: 'Seller record not found after processing'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Profile extracted and scored successfully',
      data: {
        seller: seller.toJSON(),
        extractedData,
        scoringResult: {
          pulseScore: scoringResult.pulseScore,
          confidenceLevel: scoringResult.confidenceLevel,
          recommendations: scoringResult.recommendations,
          trustIndicators: scoringResult.trustIndicators,
          riskFactors: scoringResult.riskFactors
        }
      }
    });
  } catch (error) {
    console.error('Extract and score profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to extract and score profile',
      error: error.message
    });
  }
};

/**
 * Score profile by URL without creating seller record
 * POST /api/sellers/score-by-url
 */
export const scoreProfileByUrl = async (req, res) => {
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

    const { profileUrl } = req.body;

    // Extract profile data
    const extractedData = await profileExtractionService.extractProfile(profileUrl);
    
    // Calculate pulse score
    const scoringResult = await pulseScoringService.calculatePulseScore(
      extractedData,
      extractedData.recentListings || []
    );

    res.status(200).json({
      success: true,
      message: 'Profile scored successfully',
      data: {
        profileData: extractedData.profileData,
        marketplaceData: extractedData.marketplaceData,
        recentListings: extractedData.recentListings,
        scoringResult: {
          pulseScore: scoringResult.pulseScore,
          confidenceLevel: scoringResult.confidenceLevel,
          recommendations: scoringResult.recommendations,
          trustIndicators: scoringResult.trustIndicators,
          riskFactors: scoringResult.riskFactors,
          scoringFactors: scoringResult.scoringFactors
        }
      }
    });
  } catch (error) {
    console.error('Score profile by URL error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to score profile',
      error: error.message
    });
  }
};

/**
 * Recalculate seller score
 * POST /api/sellers/:id/recalculate-score
 */
export const recalculateSellerScore = async (req, res) => {
  try {
    const { id } = req.params;

    const seller = await Seller.findById(id);
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller not found'
      });
    }

    // Re-extract profile data
    const extractedData = await profileExtractionService.extractProfile(seller.profileUrl);
    
    // Recalculate pulse score
    const scoringResult = await pulseScoringService.calculatePulseScore(
      extractedData,
      extractedData.recentListings || []
    );

    // Update seller with new score
    seller.profileData = extractedData.profileData;
    seller.pulseScore = scoringResult.pulseScore;
    seller.confidenceLevel = scoringResult.confidenceLevel;
    seller.lastScored = new Date();
    seller.scoringFactors = scoringResult.scoringFactors;
    await seller.save();

    res.status(200).json({
      success: true,
      message: 'Seller score recalculated successfully',
      data: {
        seller: seller.toJSON(),
        scoringResult: {
          pulseScore: scoringResult.pulseScore,
          confidenceLevel: scoringResult.confidenceLevel,
          recommendations: scoringResult.recommendations,
          trustIndicators: scoringResult.trustIndicators,
          riskFactors: scoringResult.riskFactors
        }
      }
    });
  } catch (error) {
    console.error('Recalculate seller score error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to recalculate seller score',
      error: error.message
    });
  }
};

/**
 * Get detailed seller analysis
 * GET /api/sellers/:id/analysis
 */
export const getSellerAnalysis = async (req, res) => {
  try {
    const { id } = req.params;

    const seller = await Seller.findById(id)
      .populate('userId', 'name email role verified')
      .populate('listingHistory', 'title price category listingDate isActive');

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller not found'
      });
    }

    // Get recent listings for analysis
    const recentListings = seller.listingHistory || [];

    // Calculate additional metrics
    const analysis = {
      seller: seller.toJSON(),
      metrics: {
        totalFlags: seller.flags.length,
        totalEndorsements: seller.endorsements.length,
        netFeedbackScore: seller.endorsements.length - seller.flags.length,
        accountAge: seller.profileData?.accountAge || 0,
        verificationStatus: seller.verificationStatus,
        lastScored: seller.lastScored
      },
      scoringBreakdown: seller.scoringFactors || {},
      trustLevel: this.determineTrustLevel(seller.pulseScore),
      riskAssessment: this.assessRiskLevel(seller.pulseScore, seller.flags.length),
      recommendations: this.generateAnalysisRecommendations(seller)
    };

    res.status(200).json({
      success: true,
      data: analysis
    });
  } catch (error) {
    console.error('Get seller analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get seller analysis',
      error: error.message
    });
  }
};

/**
 * Determine trust level based on pulse score
 */
function determineTrustLevel(pulseScore) {
  if (pulseScore >= 80) return 'High Trust';
  if (pulseScore >= 60) return 'Medium Trust';
  if (pulseScore >= 40) return 'Low Trust';
  return 'High Risk';
}

/**
 * Assess risk level
 */
function assessRiskLevel(pulseScore, flagCount) {
  if (pulseScore >= 70 && flagCount === 0) return 'Low Risk';
  if (pulseScore >= 50 && flagCount < 3) return 'Medium Risk';
  if (pulseScore >= 30 || flagCount >= 3) return 'High Risk';
  return 'Very High Risk';
}

/**
 * Generate analysis recommendations
 */
function generateAnalysisRecommendations(seller) {
  const recommendations = [];

  if (seller.pulseScore >= 80) {
    recommendations.push({
      type: 'positive',
      message: 'Highly recommended seller with excellent track record',
      action: 'Safe to transact'
    });
  } else if (seller.pulseScore >= 60) {
    recommendations.push({
      type: 'positive',
      message: 'Good seller with minor concerns',
      action: 'Proceed with caution'
    });
  } else if (seller.pulseScore >= 40) {
    recommendations.push({
      type: 'warning',
      message: 'Mixed indicators - review carefully',
      action: 'Request additional verification'
    });
  } else {
    recommendations.push({
      type: 'negative',
      message: 'High risk seller - avoid transaction',
      action: 'Do not proceed'
    });
  }

  if (seller.flags.length > 0) {
    recommendations.push({
      type: 'warning',
      message: `${seller.flags.length} flags reported against this seller`,
      action: 'Review flag details before proceeding'
    });
  }

  if (seller.verificationStatus === 'unverified') {
    recommendations.push({
      type: 'warning',
      message: 'Unverified seller identity',
      action: 'Request identity verification'
    });
  }

  return recommendations;
}
