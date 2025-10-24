import mongoose from 'mongoose';

const listingSchema = new mongoose.Schema(
  {
    // Reference to the seller
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Seller',
      required: true
    },
    
    // Platform-specific listing ID
    platformListingId: {
      type: String,
      required: true,
      index: true
    },
    
    // Platform information
    platform: {
      type: String,
      required: true,
      enum: ['facebook', 'jiji', 'other'],
      index: true
    },
    
    // Platform-specific listing URL
    listingUrl: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },
    
    // Listing data
    listingData: {
      title: {
        type: String,
        required: true,
        trim: true,
        maxlength: [200, 'Title cannot exceed 200 characters']
      },
      description: {
        type: String,
        trim: true,
        maxlength: [2000, 'Description cannot exceed 2000 characters']
      },
      price: {
        type: Number,
        required: true,
        min: 0
      },
      currency: {
        type: String,
        default: 'NGN',
        maxlength: 3
      },
      category: {
        type: String,
        required: true,
        trim: true
      },
      condition: {
        type: String,
        enum: ['new', 'like-new', 'good', 'fair', 'poor', 'unknown'],
        default: 'unknown'
      },
      images: [{
        type: String,
        trim: true
      }],
      location: {
        type: String,
        trim: true
      }
    },
    
    // Urgency and suspicious language detection
    urgencyKeywords: [{
      keyword: {
        type: String,
        required: true
      },
      severity: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'low'
      },
      context: {
        type: String,
        maxlength: [100, 'Context cannot exceed 100 characters']
      }
    }],
    
    // Price analysis
    priceAnalysis: {
      isAnomalous: {
        type: Boolean,
        default: false
      },
      anomalyType: {
        type: String,
        enum: ['too-low', 'too-high', 'normal'],
        default: 'normal'
      },
      marketPrice: {
        type: Number
      },
      priceDeviation: {
        type: Number,
        default: 0
      }
    },
    
    // Listing metadata
    listingDate: {
      type: Date,
      required: true
    },
    
    lastSeen: {
      type: Date,
      default: Date.now
    },
    
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    
    // Scoring factors for this specific listing
    scoringFactors: {
      urgencyScore: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
      },
      priceAnomalyScore: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
      },
      descriptionQuality: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
      },
      imageQuality: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
      }
    },
    
    // Overall listing score
    listingScore: {
      type: Number,
      default: 50,
      min: 0,
      max: 100
    },
    
    // Flags and reports for this listing
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
    }]
  },
  {
    timestamps: true
  }
);

// Indexes for performance
listingSchema.index({ sellerId: 1, platform: 1 });
listingSchema.index({ platformListingId: 1, platform: 1 });
listingSchema.index({ isActive: 1, listingDate: -1 });
listingSchema.index({ 'listingData.category': 1 });
listingSchema.index({ 'listingData.price': 1 });
listingSchema.index({ listingDate: -1 });

// Virtual for total flags count
listingSchema.virtual('totalFlags').get(function() {
  return this.flags.length;
});

// Method to add a flag
listingSchema.methods.addFlag = function(userId, reason) {
  this.flags.push({
    userId,
    reason,
    timestamp: new Date()
  });
  return this.save();
};

// Method to update listing score
listingSchema.methods.updateListingScore = function(scoringFactors) {
  this.scoringFactors = { ...this.scoringFactors, ...scoringFactors };
  
  // Calculate overall listing score
  const weights = {
    urgencyScore: 0.3,
    priceAnomalyScore: 0.4,
    descriptionQuality: 0.2,
    imageQuality: 0.1
  };
  
  this.listingScore = Math.round(
    (this.scoringFactors.urgencyScore * weights.urgencyScore) +
    (this.scoringFactors.priceAnomalyScore * weights.priceAnomalyScore) +
    (this.scoringFactors.descriptionQuality * weights.descriptionQuality) +
    (this.scoringFactors.imageQuality * weights.imageQuality)
  );
  
  return this.save();
};

// Method to detect urgency keywords
listingSchema.methods.detectUrgencyKeywords = function() {
  const urgencyPatterns = [
    { pattern: /urgent|asap|immediate|quick/i, severity: 'high' },
    { pattern: /need money|bills|emergency/i, severity: 'high' },
    { pattern: /first come|first serve|hurry/i, severity: 'medium' },
    { pattern: /payment first|cash only/i, severity: 'high' },
    { pattern: /no questions|serious buyers only/i, severity: 'medium' }
  ];
  
  const text = `${this.listingData.title} ${this.listingData.description}`.toLowerCase();
  const detectedKeywords = [];
  
  urgencyPatterns.forEach(({ pattern, severity }) => {
    const matches = text.match(pattern);
    if (matches) {
      detectedKeywords.push({
        keyword: matches[0],
        severity,
        context: matches[0]
      });
    }
  });
  
  this.urgencyKeywords = detectedKeywords;
  return this;
};

// Static method to find listings by seller
listingSchema.statics.findBySeller = function(sellerId, options = {}) {
  const query = { sellerId, isActive: true };
  
  if (options.platform) {
    query.platform = options.platform;
  }
  
  if (options.category) {
    query['listingData.category'] = options.category;
  }
  
  return this.find(query)
    .sort({ listingDate: -1 })
    .limit(options.limit || 50);
};

// Static method to find listings by platform
listingSchema.statics.findByPlatform = function(platform, options = {}) {
  const query = { platform, isActive: true };
  
  if (options.category) {
    query['listingData.category'] = options.category;
  }
  
  return this.find(query)
    .sort({ listingDate: -1 })
    .limit(options.limit || 100);
};

// Static method to get price statistics for a category
listingSchema.statics.getPriceStats = function(category, platform) {
  const query = { isActive: true };
  
  if (category) {
    query['listingData.category'] = category;
  }
  
  if (platform) {
    query.platform = platform;
  }
  
  return this.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        averagePrice: { $avg: '$listingData.price' },
        medianPrice: { $median: '$listingData.price' },
        minPrice: { $min: '$listingData.price' },
        maxPrice: { $max: '$listingData.price' },
        count: { $sum: 1 }
      }
    }
  ]);
};

// Remove sensitive data from JSON output
listingSchema.methods.toJSON = function() {
  const listing = this.toObject();
  delete listing.__v;
  return listing;
};

const Listing = mongoose.model('Listing', listingSchema);

export default Listing;
