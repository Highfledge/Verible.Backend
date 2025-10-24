import User from '../models/User.model.js';
import { validationResult } from 'express-validator';

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


