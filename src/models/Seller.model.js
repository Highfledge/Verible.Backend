import mongoose from 'mongoose';

const sellerSchema = new mongoose.Schema(
  {
    // Reference to the User account
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false, // Optional for extracted profiles
      default: null
    },
    
    // Seller identification across platforms
    sellerId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    
    // Platform information
    platform: {
      type: String,
      required: true,
      enum: ['facebook', 'jiji', 'other'],
      default: 'facebook'
    },
    
    // Platform-specific profile URL
    profileUrl: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },
    
    // Seller profile information (from platform)
    profileData: {
      name: {
        type: String,
        required: true,
        trim: true,
        maxlength: [100, 'Name cannot exceed 100 characters']
      },
      profilePicture: {
        type: String,
        trim: true
      },
      location: {
        type: String,
        trim: true
      },
      bio: {
        type: String,
        maxlength: [500, 'Bio cannot exceed 500 characters']
      }
    },
    
    // Pulse Score and trust metrics
    pulseScore: {
      type: Number,
      default: 50,
      min: 0,
      max: 100,
      required: true
    },
    
    confidenceLevel: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'low',
      required: true
    },
    
    lastScored: {
      type: Date,
      default: Date.now
    },
    
    // Verification status
    verificationStatus: {
      type: String,
      enum: ['unverified', 'email-verified', 'phone-verified', 'id-verified'],
      default: 'unverified'
    },
    
    verifiedAt: {
      type: Date
    },
    
    // Listing history (references to Listing documents)
    listingHistory: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Listing'
    }],
    
    // User feedback
    flags: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      reason: {
        type: String,
        required: true,
        maxlength: [200, 'Flag reason cannot exceed 200 characters']
      },
      timestamp: {
        type: Date,
        default: Date.now
      },
      isVerified: {
        type: Boolean,
        default: false
      },
      adminReview: {
        reviewedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        reviewedAt: Date,
        action: {
          type: String,
          enum: ['dismissed', 'upheld', 'pending']
        },
        adminNotes: {
          type: String,
          maxlength: [500, 'Admin notes cannot exceed 500 characters']
        }
      }
    }],
    
    endorsements: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      reason: {
        type: String,
        maxlength: [200, 'Endorsement reason cannot exceed 200 characters']
      },
      timestamp: {
        type: Date,
        default: Date.now
      },
      isVerified: {
        type: Boolean,
        default: false
      }
    }],
    
    // Scoring factors (for analysis)
    scoringFactors: {
      priceAnomaly: {
        type: Number,
        default: 0
      },
      urgencyScore: {
        type: Number,
        default: 0
      },
      profileCompleteness: {
        type: Number,
        default: 0
      },
      listingActivity: {
        type: Number,
        default: 0
      },
      userFeedback: {
        type: Number,
        default: 0
      }
    },
    
    // Status flags
    isActive: {
      type: Boolean,
      default: true
    },
    
    isClaimed: {
      type: Boolean,
      default: false
    },
    
    claimedAt: {
      type: Date
    },
    
    // Metadata
    firstSeen: {
      type: Date,
      default: Date.now
    },
    
    lastSeen: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Indexes for performance
sellerSchema.index({ sellerId: 1, platform: 1 });
sellerSchema.index({ userId: 1 }, { sparse: true }); // Sparse index for userId
sellerSchema.index({ profileUrl: 1 }); // Index for profileUrl lookups
sellerSchema.index({ pulseScore: -1 });
sellerSchema.index({ lastScored: -1 });
sellerSchema.index({ verificationStatus: 1 });

// Virtual for total flags count
sellerSchema.virtual('totalFlags').get(function() {
  return this.flags ? this.flags.length : 0;
});

// Virtual for total endorsements count
sellerSchema.virtual('totalEndorsements').get(function() {
  return this.endorsements ? this.endorsements.length : 0;
});

// Virtual for net feedback score
sellerSchema.virtual('netFeedbackScore').get(function() {
  const flagsCount = this.flags ? this.flags.length : 0;
  const endorsementsCount = this.endorsements ? this.endorsements.length : 0;
  return endorsementsCount - flagsCount;
});

// Method to add a flag
sellerSchema.methods.addFlag = function(userId, reason) {
  if (!this.flags) {
    this.flags = [];
  }
  this.flags.push({
    userId,
    reason,
    timestamp: new Date()
  });
  return this.save();
};

// Method to add an endorsement
sellerSchema.methods.addEndorsement = function(userId, reason) {
  if (!this.endorsements) {
    this.endorsements = [];
  }
  this.endorsements.push({
    userId,
    reason,
    timestamp: new Date()
  });
  return this.save();
};

// Method to update pulse score
sellerSchema.methods.updatePulseScore = function(newScore, confidenceLevel, scoringFactors) {
  this.pulseScore = Math.max(0, Math.min(100, newScore));
  this.confidenceLevel = confidenceLevel;
  this.lastScored = new Date();
  
  if (scoringFactors) {
    this.scoringFactors = { ...this.scoringFactors, ...scoringFactors };
  }
  
  return this.save();
};

// Method to verify seller
sellerSchema.methods.verifySeller = function(verificationStatus) {
  this.verificationStatus = verificationStatus;
  this.verifiedAt = new Date();
  this.isClaimed = true;
  this.claimedAt = new Date();
  
  // Apply verification bonus to pulse score
  const verificationBonus = {
    'email-verified': 5,
    'phone-verified': 10,
    'id-verified': 15
  };
  
  const bonus = verificationBonus[verificationStatus] || 0;
  this.pulseScore = Math.min(100, this.pulseScore + bonus);
  
  return this.save();
};

// Method to check if user can flag/endorse this seller
sellerSchema.methods.canUserInteract = function(userId) {
  // Users can't flag/endorse themselves
  // If seller has no userId (extracted profile), user can interact
  // If seller has userId, user can interact only if it's not their own
  return !this.userId || this.userId.toString() !== userId.toString();
};

// Static method to find seller by platform and sellerId
sellerSchema.statics.findByPlatformSeller = function(platform, sellerId) {
  return this.findOne({ platform, sellerId });
};

// Static method to find sellers by user
sellerSchema.statics.findByUser = function(userId) {
  return this.findOne({ userId });
};

// Static method to get top sellers by pulse score
sellerSchema.statics.getTopSellers = function(limit = 10) {
  return this.find({ isActive: true })
    .sort({ pulseScore: -1, lastScored: -1 })
    .limit(limit)
    .populate('userId', 'name email')
    .select('-flags -endorsements -scoringFactors');
};

// Remove sensitive data from JSON output
sellerSchema.methods.toJSON = function() {
  const seller = this.toObject();
  delete seller.__v;
  return seller;
};

const Seller = mongoose.model('Seller', sellerSchema);

export default Seller;
