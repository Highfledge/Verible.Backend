import mongoose from 'mongoose';

const extractionSchema = new mongoose.Schema(
  {
    // Reference to the User who extracted the seller
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    
    // Reference to the Seller that was extracted
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Seller',
      required: true,
      index: true
    },
    
    // Pulse score at the time of extraction (for historical tracking)
    pulseScoreAtExtraction: {
      type: Number,
      min: 0,
      max: 100
    },
    
    // Timestamp when extraction occurred
    extractedAt: {
      type: Date,
      default: Date.now,
      required: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Compound index for efficient queries: userId + extractedAt
extractionSchema.index({ userId: 1, extractedAt: -1 });

// Compound index to prevent duplicate extractions (same user extracting same seller)
extractionSchema.index({ userId: 1, sellerId: 1 }, { unique: true });

// Virtual to populate seller data
extractionSchema.virtual('seller', {
  ref: 'Seller',
  localField: 'sellerId',
  foreignField: '_id',
  justOne: true
});

// Remove sensitive data from JSON output
extractionSchema.methods.toJSON = function() {
  const extraction = this.toObject();
  delete extraction.__v;
  return extraction;
};

const Extraction = mongoose.model('Extraction', extractionSchema);

export default Extraction;

