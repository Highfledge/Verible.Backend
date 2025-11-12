import User from '../models/User.model.js';
import Extraction from '../models/Extraction.model.js';
import Seller from '../models/Seller.model.js';
import { validationResult } from 'express-validator';
import { assessRiskLevel } from '../utils/sellerAnalysis.utils.js';

/**
 * Update user profile (self only)
 * PUT /api/users/profile
 */
export const updateProfile = async (req, res) => {
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

    const { name, email, phone } = req.body;
    const currentUser = req.user;
    const id = currentUser._id;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if email/phone is already taken by another user
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser && existingUser._id.toString() !== id) {
        return res.status(400).json({
          success: false,
          message: 'Email is already taken'
        });
      }
      user.email = email.toLowerCase();
    }

    if (phone && phone !== user.phone) {
      const existingUser = await User.findOne({ phone });
      if (existingUser && existingUser._id.toString() !== id) {
        return res.status(400).json({
          success: false,
          message: 'Phone number is already taken'
        });
      }
      user.phone = phone;
    }

    if (name) {
      user.name = name;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: {
        user: user.toJSON()
      }
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user',
      error: error.message
    });
  }
};


/**
 * Delete own account
 * DELETE /api/users/account
 */
export const deleteAccount = async (req, res) => {
  try {
    const id = req.user._id;

    await User.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: error.message
    });
  }
};

/**
 * Get user's feedback history
 * GET /api/users/my-feedback
 */
export const getMyFeedback = async (req, res) => {
  try {
    const userId = req.user._id;

    // Import Seller model here to avoid circular dependency
    const Seller = (await import('../models/Seller.model.js')).default;

    // Find all sellers where user has flagged or endorsed
    const sellers = await Seller.find({
      $or: [
        { 'flags.userId': userId },
        { 'endorsements.userId': userId }
      ]
    })
    .populate('userId', 'name email')
    .select('profileData flags endorsements pulseScore platform');

    const feedbackHistory = sellers.map(seller => {
      const userFlag = seller.flags.find(flag => flag.userId.toString() === userId.toString());
      const userEndorsement = seller.endorsements.find(endorsement => endorsement.userId.toString() === userId.toString());

      return {
        seller: {
          id: seller._id,
          name: seller.profileData?.name || 'Unknown',
          platform: seller.platform,
          pulseScore: seller.pulseScore
        },
        flag: userFlag ? {
          reason: userFlag.reason,
          timestamp: userFlag.timestamp,
          isVerified: userFlag.isVerified
        } : null,
        endorsement: userEndorsement ? {
          reason: userEndorsement.reason,
          timestamp: userEndorsement.timestamp,
          isVerified: userEndorsement.isVerified
        } : null
      };
    });

    res.status(200).json({
      success: true,
      data: {
        feedbackHistory,
        totalInteractions: feedbackHistory.length
      }
    });
  } catch (error) {
    console.error('Get my feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get feedback history',
      error: error.message
    });
  }
};

/**
 * Get user's interactions with sellers
 * GET /api/users/my-interactions
 */
export const getMyInteractions = async (req, res) => {
  try {
    const userId = req.user._id;

    // Import Seller model here to avoid circular dependency
    const Seller = (await import('../models/Seller.model.js')).default;

    // Get user's flags and endorsements separately for better organization
    const flaggedSellers = await Seller.find({ 'flags.userId': userId })
      .populate('userId', 'name email')
      .select('profileData flags pulseScore platform')
      .sort({ 'flags.timestamp': -1 });

    const endorsedSellers = await Seller.find({ 'endorsements.userId': userId })
      .populate('userId', 'name email')
      .select('profileData endorsements pulseScore platform')
      .sort({ 'endorsements.timestamp': -1 });

    const interactions = {
      flagged: flaggedSellers.map(seller => {
        const flag = seller.flags.find(f => f.userId.toString() === userId.toString());
        return {
          seller: {
            id: seller._id,
            name: seller.profileData?.name || 'Unknown',
            platform: seller.platform,
            pulseScore: seller.pulseScore
          },
          flag: {
            reason: flag.reason,
            timestamp: flag.timestamp,
            isVerified: flag.isVerified
          }
        };
      }),
      endorsed: endorsedSellers.map(seller => {
        const endorsement = seller.endorsements.find(e => e.userId.toString() === userId.toString());
        return {
          seller: {
            id: seller._id,
            name: seller.profileData?.name || 'Unknown',
            platform: seller.platform,
            pulseScore: seller.pulseScore
          },
          endorsement: {
            reason: endorsement.reason,
            timestamp: endorsement.timestamp,
            isVerified: endorsement.isVerified
          }
        };
      })
    };

    res.status(200).json({
      success: true,
      data: {
        interactions,
        summary: {
          totalFlags: interactions.flagged.length,
          totalEndorsements: interactions.endorsed.length,
          totalInteractions: interactions.flagged.length + interactions.endorsed.length
        }
      }
    });
  } catch (error) {
    console.error('Get my interactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get interactions',
      error: error.message
    });
  }
};

/**
 * Get user's extracted sellers with metrics
 * GET /api/users/my-extractions?timeRange=7d|30d
 */
export const getUserExtractions = async (req, res) => {
  try {
    const userId = req.user._id;
    const { timeRange = '7d' } = req.query;

    // Validate timeRange
    if (!['7d', '30d'].includes(timeRange)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid timeRange. Must be "7d" or "30d"'
      });
    }

    const days = timeRange === '7d' ? 7 : 30;
    const now = new Date();
    const currentPeriodStart = new Date(now);
    currentPeriodStart.setDate(currentPeriodStart.getDate() - days);
    currentPeriodStart.setHours(0, 0, 0, 0);

    // Previous period (same duration as current period, for comparison)
    // Previous period ends just before current period starts
    const previousPeriodEnd = new Date(currentPeriodStart);
    previousPeriodEnd.setMilliseconds(previousPeriodEnd.getMilliseconds() - 1);
    // Previous period starts 'days' before the end of previous period
    const previousPeriodStart = new Date(previousPeriodEnd);
    previousPeriodStart.setDate(previousPeriodStart.getDate() - days);
    previousPeriodStart.setHours(0, 0, 0, 0);

    // Get current period extractions with seller data
    const currentExtractions = await Extraction.find({
      userId,
      extractedAt: { $gte: currentPeriodStart }
    })
      .populate('sellerId')
      .sort({ extractedAt: -1 });

    // Get previous period extractions with seller data (for period-over-period comparison)
    const previousExtractions = await Extraction.find({
      userId,
      extractedAt: {
        $gte: previousPeriodStart,
        $lte: previousPeriodEnd
      }
    })
      .populate('sellerId');

    // Filter out extractions where seller was deleted
    const validCurrentExtractions = currentExtractions.filter(
      ext => ext.sellerId && ext.sellerId.pulseScore !== undefined
    );
    const validPreviousExtractions = previousExtractions.filter(
      ext => ext.sellerId && ext.sellerId.pulseScore !== undefined
    );

    // Calculate current period metrics
    const currentCount = validCurrentExtractions.length;
    const currentPulseScores = validCurrentExtractions.map(
      ext => ext.sellerId.pulseScore
    );
    const currentAvgPulseScore =
      currentPulseScores.length > 0
        ? currentPulseScores.reduce((sum, score) => sum + score, 0) /
          currentPulseScores.length
        : 0;

    // Count high risk sellers in current period
    // High risk: pulseScore < 40 OR assessRiskLevel returns "High Risk" or "Very High Risk"
    const currentHighRiskCount = validCurrentExtractions.filter(ext => {
      const seller = ext.sellerId;
      const riskLevel = assessRiskLevel(
        seller.pulseScore,
        seller.flags?.length || 0
      );
      return seller.pulseScore < 40 || 
             riskLevel === 'High Risk' || 
             riskLevel === 'Very High Risk';
    }).length;

    // Calculate previous period metrics
    const previousCount = validPreviousExtractions.length;
    const previousPulseScores = validPreviousExtractions.map(
      ext => ext.sellerId.pulseScore
    );
    const previousAvgPulseScore =
      previousPulseScores.length > 0
        ? previousPulseScores.reduce((sum, score) => sum + score, 0) /
          previousPulseScores.length
        : 0;

    // Count high risk sellers in previous period
    const previousHighRiskCount = validPreviousExtractions.filter(ext => {
      const seller = ext.sellerId;
      const riskLevel = assessRiskLevel(
        seller.pulseScore,
        seller.flags?.length || 0
      );
      return seller.pulseScore < 40 || 
             riskLevel === 'High Risk' || 
             riskLevel === 'Very High Risk';
    }).length;

    // Calculate percentage changes
    const calculatePercentageChange = (current, previous) => {
      if (previous === 0) {
        return current > 0 ? 100 : 0;
      }
      return ((current - previous) / previous) * 100;
    };

    const totalCountChange = calculatePercentageChange(
      currentCount,
      previousCount
    );
    const avgPulseScoreChange = currentAvgPulseScore - previousAvgPulseScore;
    const highRiskCountChange = calculatePercentageChange(
      currentHighRiskCount,
      previousHighRiskCount
    );

    // Format changes with + or - sign
    const formatPercentageChange = (value) => {
      if (value === 0) return '0.0%';
      const sign = value > 0 ? '+' : '-';
      return `${sign}${Math.abs(value).toFixed(1)}%`;
    };

    const formatPointChange = (value) => {
      if (value === 0) return '0.0';
      const sign = value > 0 ? '+' : '-';
      return `${sign}${Math.abs(value).toFixed(1)}`;
    };

    // Prepare sellers data (without sensitive info)
    const sellers = validCurrentExtractions.map(ext => {
      const seller = ext.sellerId.toJSON();
      return {
        id: seller._id,
        sellerId: seller.sellerId,
        platform: seller.platform,
        profileUrl: seller.profileUrl,
        profileData: seller.profileData,
        pulseScore: seller.pulseScore,
        confidenceLevel: seller.confidenceLevel,
        verificationStatus: seller.verificationStatus,
        extractedAt: ext.extractedAt,
        createdAt: seller.createdAt
      };
    });

    res.status(200).json({
      success: true,
      data: {
        timeRange,
        sellers,
        metrics: {
          totalCount: currentCount,
          totalCountChange: formatPercentageChange(totalCountChange),
          totalCountChangeValue: parseFloat(totalCountChange.toFixed(1)),
          averagePulseScore: parseFloat(currentAvgPulseScore.toFixed(1)),
          averagePulseScoreChange: formatPointChange(avgPulseScoreChange),
          averagePulseScoreChangeValue: parseFloat(avgPulseScoreChange.toFixed(1)),
          highRiskCount: currentHighRiskCount,
          highRiskCountChange: formatPercentageChange(highRiskCountChange),
          highRiskCountChangeValue: parseFloat(highRiskCountChange.toFixed(1))
        },
        period: {
          current: {
            start: currentPeriodStart.toISOString(),
            end: now.toISOString()
          },
          previous: {
            start: previousPeriodStart.toISOString(),
            end: previousPeriodEnd.toISOString()
          }
        }
      }
    });
  } catch (error) {
    console.error('Get user extractions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user extractions',
      error: error.message
    });
  }
};

/**
 * Get top 5 critical threats (sellers with worst pulse scores)
 * GET /api/users/threats/top
 */
export const getTopThreats = async (req, res) => {
  try {
    const limit = 5;

    // Get sellers with worst pulse scores (lowest = worst)
    // Only include sellers with valid pulse scores (0-100)
    const sellers = await Seller.find({ 
      isActive: true,
      pulseScore: { $exists: true, $gte: 0, $lte: 100 }
    })
      .sort({ pulseScore: 1, lastScored: -1 }) // Ascending pulse score (worst first)
      .limit(limit)
      .select('profileData platform pulseScore lastScored flags scoringFactors createdAt updatedAt');

    // Handle empty results
    if (!sellers || sellers.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          threats: [],
          count: 0,
          retrievedAt: new Date().toISOString(),
          message: 'No threats found'
        }
      });
    }

    // Get extraction counts for each seller
    const sellerIds = sellers.map(seller => seller._id);
    let extractionCounts = [];
    
    if (sellerIds.length > 0) {
      extractionCounts = await Extraction.aggregate([
        {
          $match: {
            sellerId: { $in: sellerIds }
          }
        },
        {
          $group: {
            _id: '$sellerId',
            count: { $sum: 1 }
          }
        }
      ]);
    }

    // Create a map of sellerId to extraction count
    const extractionMap = new Map();
    extractionCounts.forEach(item => {
      extractionMap.set(item._id.toString(), item.count);
    });

    // Helper function to map platform to display name
    const getPlatformDisplayName = (platform) => {
      const platformMap = {
        'facebook': 'Facebook Marketplace',
        'jiji': 'Jiji',
        'jumia': 'Jumia',
        'konga': 'Konga',
        'etsy': 'Etsy',
        'kijiji': 'Kijiji',
        'instagram': 'Instagram',
        'ebay': 'eBay',
        'other': 'Other'
      };
      return platformMap[platform] || platform;
    };

    // Helper function to determine severity level
    const getSeverityLevel = (pulseScore) => {
      if (pulseScore < 30) return 'CRITICAL';
      if (pulseScore < 50) return 'HIGH';
      if (pulseScore < 70) return 'MEDIUM';
      return 'LOW';
    };

    // Helper function to calculate time ago
    const getTimeAgo = (date) => {
      if (!date) return 'Unknown';
      
      const now = new Date();
      const diffMs = now - new Date(date);
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      
      const weeks = Math.floor(diffDays / 7);
      if (weeks < 4) return `${weeks}w ago`;
      
      const months = Math.floor(diffDays / 30);
      return `${months}mo ago`;
    };

    // Helper function to generate description
    const generateDescription = (seller) => {
      // Priority 1: Most recent flag reason
      if (seller.flags && seller.flags.length > 0) {
        const sortedFlags = [...seller.flags].sort((a, b) => 
          new Date(b.timestamp) - new Date(a.timestamp)
        );
        const mostRecentFlag = sortedFlags[0];
        if (mostRecentFlag.reason) {
          return mostRecentFlag.reason;
        }
      }

      // Priority 2: Risk factors from scoring
      if (seller.scoringFactors) {
        const riskFactors = seller.scoringFactors.behavioralRedFlags?.breakdown?.redFlags || [];
        if (riskFactors.length > 0) {
          const flags = riskFactors.map(rf => rf.flag).join(', ');
          return `Multiple red flags detected: ${flags}`;
        }

        // Check other risk factors
        if (seller.scoringFactors.verificationIdentity?.score < 30) {
          return 'Unverified seller with multiple fraud indicators';
        }
        if (seller.scoringFactors.accountMaturity?.score < 40) {
          return 'New account with suspicious activity';
        }
        if (seller.scoringFactors.behavioralRedFlags?.score < 70) {
          return 'Suspicious behavior patterns detected in listings';
        }
      }

      // Priority 3: Generate based on pulse score and flags
      const severity = getSeverityLevel(seller.pulseScore);
      const flagCount = seller.flags?.length || 0;
      
      if (severity === 'CRITICAL') {
        if (flagCount > 0) {
          return `Multiple fraud indicators reported by ${flagCount} user${flagCount > 1 ? 's' : ''}`;
        }
        return 'Multiple fraud indicators: new account, unverified, suspicious activity';
      }
      if (severity === 'HIGH') {
        if (flagCount > 0) {
          return `${flagCount} user${flagCount > 1 ? 's' : ''} reported suspicious activity`;
        }
        return 'High-risk seller with multiple concerns';
      }
      if (severity === 'MEDIUM') {
        return 'Seller flagged for review - proceed with caution';
      }

      return 'Seller requires attention';
    };

    // Format threats
    const threats = sellers.map(seller => {
      const usersAffected = extractionMap.get(seller._id.toString()) || 0;
      const severity = getSeverityLevel(seller.pulseScore);
      const timeAgo = getTimeAgo(seller.lastScored || seller.updatedAt);

      return {
        sellerId: seller._id.toString(),
        sellerName: seller.profileData?.name || 'Unknown',
        platform: getPlatformDisplayName(seller.platform),
        usersAffected,
        timeAgo,
        location: seller.profileData?.location || null,
        riskScore: seller.pulseScore,
        severity,
        description: generateDescription(seller),
        lastScored: seller.lastScored?.toISOString() || null,
        flagCount: seller.flags?.length || 0
      };
    });

    res.status(200).json({
      success: true,
      data: {
        threats,
        count: threats.length,
        retrievedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Get top threats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get top threats',
      error: error.message
    });
  }
};

/**
 * Get user's recent activity (unified feed)
 * GET /api/users/recent-activity?limit=20&timeRange=7d|30d|all
 */
export const getRecentActivity = async (req, res) => {
  try {
    const userId = req.user._id;
    const { limit = 20, timeRange = '30d' } = req.query;

    // Validate limit
    const limitNum = parseInt(limit, 10);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        message: 'Invalid limit. Must be between 1 and 100'
      });
    }

    // Validate timeRange
    if (!['7d', '30d', 'all'].includes(timeRange)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid timeRange. Must be "7d", "30d", or "all"'
      });
    }

    // Calculate date filter
    let dateFilter = {};
    if (timeRange !== 'all') {
      const days = timeRange === '7d' ? 7 : 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);
      dateFilter = { $gte: startDate };
    }

    const activities = [];

    // 1. Get profile extractions
    const extractions = await Extraction.find({
      userId,
      ...(timeRange !== 'all' && { extractedAt: dateFilter })
    })
      .populate('sellerId', 'profileData platform pulseScore profileUrl')
      .sort({ extractedAt: -1 })
      .limit(limitNum * 2); // Get more to account for filtering

    extractions.forEach(extraction => {
      if (extraction.sellerId) {
        activities.push({
          type: 'extraction',
          timestamp: extraction.extractedAt,
          details: {
            seller: {
              id: extraction.sellerId._id,
              name: extraction.sellerId.profileData?.name || 'Unknown',
              platform: extraction.sellerId.platform,
              profileUrl: extraction.sellerId.profileUrl,
              pulseScore: extraction.pulseScoreAtExtraction || extraction.sellerId.pulseScore
            },
            pulseScoreAtExtraction: extraction.pulseScoreAtExtraction
          }
        });
      }
    });

    // 2. Get flags
    const flaggedSellers = await Seller.find({
      'flags.userId': userId
    })
      .select('profileData flags pulseScore platform profileUrl')
      .lean();

    const startDate = timeRange !== 'all' ? dateFilter.$gte : null;

    flaggedSellers.forEach(seller => {
      const userFlags = seller.flags.filter(flag => {
        if (flag.userId.toString() !== userId.toString()) {
          return false;
        }
        if (startDate && new Date(flag.timestamp) < startDate) {
          return false;
        }
        return true;
      });

      userFlags.forEach(flag => {
        activities.push({
          type: 'flag',
          timestamp: flag.timestamp,
          details: {
            seller: {
              id: seller._id,
              name: seller.profileData?.name || 'Unknown',
              platform: seller.platform,
              profileUrl: seller.profileUrl,
              pulseScore: seller.pulseScore
            },
            reason: flag.reason,
            isVerified: flag.isVerified
          }
        });
      });
    });

    // 3. Get endorsements
    const endorsedSellers = await Seller.find({
      'endorsements.userId': userId
    })
      .select('profileData endorsements pulseScore platform profileUrl')
      .lean();

    endorsedSellers.forEach(seller => {
      const userEndorsements = seller.endorsements.filter(endorsement => {
        if (endorsement.userId.toString() !== userId.toString()) {
          return false;
        }
        if (startDate && new Date(endorsement.timestamp) < startDate) {
          return false;
        }
        return true;
      });

      userEndorsements.forEach(endorsement => {
        activities.push({
          type: 'endorsement',
          timestamp: endorsement.timestamp,
          details: {
            seller: {
              id: seller._id,
              name: seller.profileData?.name || 'Unknown',
              platform: seller.platform,
              profileUrl: seller.profileUrl,
              pulseScore: seller.pulseScore
            },
            reason: endorsement.reason,
            isVerified: endorsement.isVerified
          }
        });
      });
    });

    // Sort all activities by timestamp (most recent first)
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Limit results
    const limitedActivities = activities.slice(0, limitNum);

    // Calculate summary statistics
    const summary = {
      total: activities.length,
      byType: {
        extraction: activities.filter(a => a.type === 'extraction').length,
        flag: activities.filter(a => a.type === 'flag').length,
        endorsement: activities.filter(a => a.type === 'endorsement').length
      }
    };

    res.status(200).json({
      success: true,
      data: {
        activities: limitedActivities,
        summary,
        pagination: {
          limit: limitNum,
          returned: limitedActivities.length,
          total: activities.length,
          hasMore: activities.length > limitNum
        },
        timeRange
      }
    });
  } catch (error) {
    console.error('Get recent activity error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get recent activity',
      error: error.message
    });
  }
};


