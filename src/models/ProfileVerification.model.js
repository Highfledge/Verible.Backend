import mongoose from 'mongoose';

const profileVerificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    profileUrl: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    verificationCode: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    status: {
      type: String,
      enum: ['pending', 'verified', 'expired'],
      default: 'pending',
      index: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true
    },
    verifiedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// Compound index for userId and profileUrl to ensure one active verification per user per URL
profileVerificationSchema.index({ userId: 1, profileUrl: 1, status: 1 });

// Method to check if verification is expired
profileVerificationSchema.methods.isExpired = function() {
  return this.expiresAt < new Date();
};

// Method to mark as verified
profileVerificationSchema.methods.markAsVerified = function() {
  this.status = 'verified';
  this.verifiedAt = new Date();
  return this.save();
};

// Static method to find active verification
profileVerificationSchema.statics.findActiveVerification = function(userId, profileUrl) {
  return this.findOne({
    userId,
    profileUrl,
    status: 'pending',
    expiresAt: { $gt: new Date() }
  });
};

// Static method to find verified verification
profileVerificationSchema.statics.findVerifiedVerification = function(userId, profileUrl) {
  return this.findOne({
    userId,
    profileUrl,
    status: 'verified'
  });
};

// Static method to expire old pending verifications
profileVerificationSchema.statics.expireOldVerifications = async function() {
  return this.updateMany(
    {
      status: 'pending',
      expiresAt: { $lt: new Date() }
    },
    {
      $set: { status: 'expired' }
    }
  );
};

// Remove sensitive data from JSON output
profileVerificationSchema.methods.toJSON = function() {
  const verification = this.toObject();
  delete verification.__v;
  return verification;
};

const ProfileVerification = mongoose.model('ProfileVerification', profileVerificationSchema);

export default ProfileVerification;

