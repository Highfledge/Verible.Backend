import User from '../models/User.model.js';
import Seller from '../models/Seller.model.js';
import Listing from '../models/Listing.model.js';
import { generateUserToken } from '../utils/jwt.js';
import { validationResult } from 'express-validator';

/**
 * Admin login
 * POST /api/admin/login
 */
export const adminLogin = async (req, res) => {
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

    const { email, password } = req.body;

    // Find admin user
    const admin = await User.findOne({ 
      email: email.toLowerCase(),
      role: 'admin'
    }).select('+passwordHash');

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid admin credentials'
      });
    }

    if (!admin.verified) {
      return res.status(401).json({
        success: false,
        message: 'Admin account not verified'
      });
    }

    // Check password
    const isPasswordValid = await admin.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid admin credentials'
      });
    }

    // Generate JWT token
    const token = generateUserToken(admin);

    res.status(200).json({
      success: true,
      message: 'Admin login successful',
      data: {
        admin: admin.toJSON(),
        token
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Admin login failed',
      error: error.message
    });
  }
};

/**
 * Get current admin profile
 * GET /api/admin/me
 */
export const getCurrentAdmin = async (req, res) => {
  try {
    const admin = req.user;

    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        admin: admin.toJSON()
      }
    });
  } catch (error) {
    console.error('Get current admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get admin profile',
      error: error.message
    });
  }
};

/**
 * Get system overview analytics
 * GET /api/admin/analytics/overview
 */
export const getSystemOverview = async (req, res) => {
  try {
    // Get counts for all entities
    const [
      totalUsers,
      totalSellers,
      totalListings,
      verifiedUsers,
      verifiedSellers,
      activeListings,
      flaggedSellers,
      flaggedListings
    ] = await Promise.all([
      User.countDocuments(),
      Seller.countDocuments(),
      Listing.countDocuments(),
      User.countDocuments({ verified: true }),
      Seller.countDocuments({ verificationStatus: { $ne: 'unverified' } }),
      Listing.countDocuments({ isActive: true }),
      Seller.countDocuments({ 'flags.0': { $exists: true } }),
      Listing.countDocuments({ 'flags.0': { $exists: true } })
    ]);

    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [
      recentUsers,
      recentSellers,
      recentListings
    ] = await Promise.all([
      User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      Seller.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      Listing.countDocuments({ createdAt: { $gte: sevenDaysAgo } })
    ]);

    // Get platform distribution
    const platformStats = await Seller.aggregate([
      {
        $group: {
          _id: '$platform',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get verification status distribution
    const verificationStats = await Seller.aggregate([
      {
        $group: {
          _id: '$verificationStatus',
          count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalUsers,
          totalSellers,
          totalListings,
          verifiedUsers,
          verifiedSellers,
          activeListings,
          flaggedSellers,
          flaggedListings
        },
        recentActivity: {
          users: recentUsers,
          sellers: recentSellers,
          listings: recentListings
        },
        platformDistribution: platformStats,
        verificationDistribution: verificationStats
      }
    });
  } catch (error) {
    console.error('Get system overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get system overview',
      error: error.message
    });
  }
};

/**
 * Get all users with pagination and filters
 * GET /api/admin/users
 */
export const getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const { role, verified, search } = req.query;
    
    // Build filter object
    const filter = {};
    if (role) filter.role = role;
    if (verified !== undefined) filter.verified = verified === 'true';
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-passwordHash -verificationCode -resetPasswordToken'),
      User.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit
        }
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get users',
      error: error.message
    });
  }
};

/**
 * Get user details
 * GET /api/admin/users/:id
 */
export const getUserDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id)
      .select('-passwordHash -verificationCode -resetPasswordToken');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user's sellers if they are a seller
    let sellers = [];
    if (user.role === 'seller') {
      sellers = await Seller.find({ userId: id })
        .select('-flags -endorsements -scoringFactors');
    }

    res.status(200).json({
      success: true,
      data: {
        user,
        sellers
      }
    });
  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user details',
      error: error.message
    });
  }
};

/**
 * Update user status (suspend/activate)
 * PUT /api/admin/users/:id/status
 */
export const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'active' or 'suspended'

    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Use "active" or "suspended"'
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent admin from suspending themselves
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot suspend your own account'
      });
    }

    // Update user status
    user.isActive = status === 'active';
    await user.save();

    res.status(200).json({
      success: true,
      message: `User ${status === 'active' ? 'activated' : 'suspended'} successfully`,
      data: {
        user: user.toJSON()
      }
    });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user status',
      error: error.message
    });
  }
};

/**
 * Get all sellers with pagination and filters
 * GET /api/admin/sellers
 */
export const getAllSellers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const { platform, verificationStatus, isActive, search } = req.query;
    
    // Build filter object
    const filter = {};
    if (platform) filter.platform = platform;
    if (verificationStatus) filter.verificationStatus = verificationStatus;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (search) {
      filter.$or = [
        { 'profileData.name': { $regex: search, $options: 'i' } },
        { sellerId: { $regex: search, $options: 'i' } }
      ];
    }

    const [sellers, total] = await Promise.all([
      Seller.find(filter)
        .populate('userId', 'name email phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Seller.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      data: {
        sellers,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit
        }
      }
    });
  } catch (error) {
    console.error('Get all sellers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get sellers',
      error: error.message
    });
  }
};

/**
 * Get seller details
 * GET /api/admin/sellers/:id
 */
export const getSellerDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const seller = await Seller.findById(id)
      .populate('userId', 'name email phone')
      .populate('flags.userId', 'name email')
      .populate('endorsements.userId', 'name email');

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller not found'
      });
    }

    // Get seller's listings
    const listings = await Listing.find({ sellerId: id })
      .sort({ createdAt: -1 })
      .limit(10);

    res.status(200).json({
      success: true,
      data: {
        seller,
        recentListings: listings
      }
    });
  } catch (error) {
    console.error('Get seller details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get seller details',
      error: error.message
    });
  }
};

/**
 * Update seller status
 * PUT /api/admin/sellers/:id/status
 */
export const updateSellerStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const seller = await Seller.findById(id);
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller not found'
      });
    }

    seller.isActive = isActive;
    await seller.save();

    res.status(200).json({
      success: true,
      message: `Seller ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        seller: seller.toJSON()
      }
    });
  } catch (error) {
    console.error('Update seller status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update seller status',
      error: error.message
    });
  }
};

/**
 * Manually verify seller
 * POST /api/admin/sellers/:id/verify
 */
export const verifySeller = async (req, res) => {
  try {
    const { id } = req.params;
    const { verificationStatus } = req.body;

    if (!['email-verified', 'phone-verified', 'id-verified'].includes(verificationStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification status'
      });
    }

    const seller = await Seller.findById(id);
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller not found'
      });
    }

    // Use the seller's verifySeller method
    await seller.verifySeller(verificationStatus);

    res.status(200).json({
      success: true,
      message: 'Seller verified successfully',
      data: {
        seller: seller.toJSON()
      }
    });
  } catch (error) {
    console.error('Verify seller error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify seller',
      error: error.message
    });
  }
};

/**
 * Get all flags with pagination
 * GET /api/admin/flags
 */
export const getAllFlags = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const { type, status, search } = req.query; // type: 'seller' or 'listing'
    
    let filter = {};
    let model, populateFields;
    
    if (type === 'listing') {
      model = Listing;
      filter = { 'flags.0': { $exists: true } };
      populateFields = [
        { path: 'sellerId', select: 'profileData.name sellerId platform' },
        { path: 'flags.userId', select: 'name email' }
      ];
    } else {
      model = Seller;
      filter = { 'flags.0': { $exists: true } };
      populateFields = [
        { path: 'userId', select: 'name email phone' },
        { path: 'flags.userId', select: 'name email' }
      ];
    }

    if (search) {
      if (type === 'listing') {
        filter.$or = [
          { 'listingData.title': { $regex: search, $options: 'i' } },
          { 'listingData.description': { $regex: search, $options: 'i' } }
        ];
      } else {
        filter.$or = [
          { 'profileData.name': { $regex: search, $options: 'i' } },
          { sellerId: { $regex: search, $options: 'i' } }
        ];
      }
    }

    const [items, total] = await Promise.all([
      model.find(filter)
        .populate(populateFields)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit),
      model.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      data: {
        flags: items,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit
        }
      }
    });
  } catch (error) {
    console.error('Get all flags error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get flags',
      error: error.message
    });
  }
};

/**
 * Review flag (dismiss/upheld)
 * PUT /api/admin/flags/:id/review
 */
export const reviewFlag = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, flagIndex, action, adminNotes } = req.body; // type: 'seller' or 'listing'
    
    if (!['seller', 'listing'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid type. Use "seller" or "listing"'
      });
    }

    if (!['dismissed', 'upheld'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Use "dismissed" or "upheld"'
      });
    }

    let model;
    if (type === 'listing') {
      model = Listing;
    } else {
      model = Seller;
    }

    const item = await model.findById(id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: `${type} not found`
      });
    }

    if (!item.flags || !item.flags[flagIndex]) {
      return res.status(404).json({
        success: false,
        message: 'Flag not found'
      });
    }

    // Update flag review
    item.flags[flagIndex].adminReview = {
      reviewedBy: req.user._id,
      reviewedAt: new Date(),
      action,
      adminNotes
    };

    await item.save();

    res.status(200).json({
      success: true,
      message: `Flag ${action} successfully`,
      data: {
        flag: item.flags[flagIndex]
      }
    });
  } catch (error) {
    console.error('Review flag error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to review flag',
      error: error.message
    });
  }
};

/**
 * Delete user
 * DELETE /api/admin/users/:id
 */
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent admin from deleting themselves
    if (id === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Delete associated sellers and listings
    await Promise.all([
      Seller.deleteMany({ userId: id }),
      Listing.deleteMany({ sellerId: { $in: await Seller.find({ userId: id }).distinct('_id') } })
    ]);

    // Delete user
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
 * Delete seller
 * DELETE /api/admin/sellers/:id
 */
export const deleteSeller = async (req, res) => {
  try {
    const { id } = req.params;

    const seller = await Seller.findById(id);
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller not found'
      });
    }

    // Delete associated listings
    await Listing.deleteMany({ sellerId: id });

    // Delete seller
    await Seller.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Seller deleted successfully'
    });
  } catch (error) {
    console.error('Delete seller error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete seller',
      error: error.message
    });
  }
};

/**
 * System health check
 * GET /api/admin/system/health
 */
export const getSystemHealth = async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Test database connection
    const dbStart = Date.now();
    await User.findOne().limit(1);
    const dbTime = Date.now() - dbStart;

    const responseTime = Date.now() - startTime;

    res.status(200).json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        responseTime: `${responseTime}ms`,
        database: {
          status: 'connected',
          responseTime: `${dbTime}ms`
        },
        uptime: process.uptime()
      }
    });
  } catch (error) {
    console.error('System health check error:', error);
    res.status(500).json({
      success: false,
      message: 'System health check failed',
      error: error.message
    });
  }
};
