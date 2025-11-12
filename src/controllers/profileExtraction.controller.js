import Seller from '../models/Seller.model.js';
import Extraction from '../models/Extraction.model.js';
import profileExtractionService from '../services/profileExtraction.service.js';
import pulseScoringService from '../services/pulseScoring.service.js';
import { validationResult } from 'express-validator';
import {
  buildVeribleFeedback,
  saveExtractedSeller
} from '../services/sellerProfilePersistence.service.js';
import {
  determineTrustLevel,
  assessRiskLevel,
  generateAnalysisRecommendations
} from '../utils/sellerAnalysis.utils.js';

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
    
    const existingSeller = await Seller.findOne({ profileUrl });
    const veribleFeedback = buildVeribleFeedback(existingSeller);
    
    // Calculate pulse score with Verible feedback if available
    const scoringResult = await pulseScoringService.calculatePulseScore(
      extractedData,
      extractedData.recentListings || [],
      veribleFeedback
    );

    // Handle insufficient data case
    if (scoringResult.status === 'insufficient_data') {
      return res.status(200).json({
        success: true,
        message: 'Profile extracted but insufficient data for scoring',
        data: {
          extractedData,
          scoringResult
        }
      });
    }

    const seller = await saveExtractedSeller({
      existingSeller,
      profileUrl,
      extractedData,
      scoringResult
    });

    if (!seller) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create or find seller record',
        error: 'Seller record not found after processing'
      });
    }

    // Track extraction if user is authenticated
    if (req.user && req.user._id) {
      try {
        // Use findOneAndUpdate with upsert to handle duplicate extractions gracefully
        await Extraction.findOneAndUpdate(
          { userId: req.user._id, sellerId: seller._id },
          {
            userId: req.user._id,
            sellerId: seller._id,
            pulseScoreAtExtraction: scoringResult.pulseScore,
            extractedAt: new Date()
          },
          { upsert: true, new: true }
        );
      } catch (error) {
        // Log error but don't fail the request if extraction tracking fails
        console.error('Failed to track extraction:', error);
      }
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
    
    // Calculate pulse score (no Verible feedback for quick scores)
    const scoringResult = await pulseScoringService.calculatePulseScore(
      extractedData,
      extractedData.recentListings || [],
      null
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
          categories: scoringResult.categories // Return categories in API response
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
    
    // Get Verible feedback for this seller
    const veribleFeedback = {
      endorsements: seller.endorsements || [],
      flags: seller.flags || []
    };
    
    // Recalculate pulse score with Verible feedback
    const scoringResult = await pulseScoringService.calculatePulseScore(
      extractedData,
      extractedData.recentListings || [],
      veribleFeedback
    );

    // Update seller with new score
    seller.profileData = extractedData.profileData;
    seller.marketplaceData = extractedData.marketplaceData;
    seller.recentListings = extractedData.recentListings;
    seller.trustIndicators = extractedData.trustIndicators;
    seller.pulseScore = scoringResult.pulseScore;
    seller.confidenceLevel = scoringResult.confidenceLevel;
    seller.lastScored = new Date();
    seller.scoringFactors = scoringResult.categories; // Save categories as scoringFactors
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
      riskAssessment: assessRiskLevel(seller.pulseScore, seller.flags.length),
      recommendations: generateAnalysisRecommendations(seller)
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
