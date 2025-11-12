/**
 * Pulse Scoring Engine - Version 2.0
 * Implements 7-category weighted scoring system with confidence metrics
 */
class PulseScoringService {
  constructor() {
    this.categoryWeights = {
      verificationIdentity: 0.25,      // 25%
      accountMaturity: 0.15,           // 15%
      listingCompleteness: 0.15,       // 15%
      activityRecency: 0.10,           // 10%
      engagement: 0.10,                // 10%
      communityFeedback: 0.10,         // 10%
      behavioralRedFlags: 0.15         // 15%
    };
  }

  /**
   * Calculate pulse score for a seller
   * @param {Object} sellerData - Extracted seller data
   * @param {Array} recentListings - Recent listings data (last 5)
   * @param {Object} veribleFeedback - Feedback from Verible users {endorsements: [], flags: []}
   * @returns {Object} Score breakdown and final score or "Not Enough Data"
   */
  async calculatePulseScore(sellerData, recentListings = [], veribleFeedback = null) {
    try {
      // Calculate each category score
      const categories = {
        verificationIdentity: this.calculateVerificationIdentityScore(sellerData),
        accountMaturity: this.calculateAccountMaturityScore(sellerData),
        listingCompleteness: this.calculateListingCompletenessScore(recentListings, sellerData),
        activityRecency: this.calculateActivityRecencyScore(sellerData, recentListings),
        engagement: this.calculateEngagementScore(sellerData),
        communityFeedback: this.calculateCommunityFeedbackScore(sellerData, veribleFeedback),
        behavioralRedFlags: this.calculateBehavioralRedFlagsScore(recentListings, sellerData)
      };

      // Calculate confidence score
      const confidenceMetrics = this.calculateConfidence(sellerData, recentListings, categories);
      
      // Check if we have enough data
      if (confidenceMetrics.confidence < 0.35 || confidenceMetrics.coverage < 0.40) {
        return {
          status: 'insufficient_data',
          message: 'Not Enough Data',
          confidence: confidenceMetrics.confidence,
          coverage: confidenceMetrics.coverage,
          availableCategories: confidenceMetrics.availableCategories,
          missingCategories: confidenceMetrics.missingCategories,
          recommendations: [
            {
              type: 'warning',
              message: 'Insufficient data to generate reliable trust score',
              action: 'More seller activity or profile information needed'
            }
          ]
        };
      }

      // Reweight categories if some are N/A
      const { finalScore, normalizedWeights } = this.calculateFinalScore(categories);

      // Generate recommendations and insights
      const recommendations = this.generateRecommendations(finalScore, categories);
      const trustLevel = this.determineTrustLevel(finalScore);
      const riskFactors = this.identifyRiskFactors(categories);

      return {
        status: 'success',
        pulseScore: finalScore,
        confidence: confidenceMetrics.confidence,
        confidenceLevel: this.getConfidenceLabel(confidenceMetrics.confidence),
        trustLevel,
        categories,
        categoryWeights: normalizedWeights,
        confidenceMetrics,
        recommendations,
        riskFactors,
        strengthAreas: this.identifyStrengths(categories)
      };
    } catch (error) {
      console.error('Pulse scoring error:', error);
      throw new Error(`Failed to calculate pulse score: ${error.message}`);
    }
  }

  /**
   * Category 1: Verification & Identity (25%)
   * Measures: ID/phone/email verification + profile photo + location
   */
  calculateVerificationIdentityScore(sellerData) {
    const verification = sellerData.marketplaceData?.verificationStatus?.toLowerCase() || 'unverified';
    const hasPhoto = !!sellerData.profileData?.profilePicture;
    const hasLocation = sellerData.profileData?.location && 
                       sellerData.profileData.location !== 'Not specified';
    const dataAvailability = sellerData.dataAvailability || {};

    let score = 0;
    let breakdown = {};

    // Base verification score
    if (verification.includes('id') || verification === 'id-verified' || verification === 'identity verified') {
      score = 100;
      breakdown.verificationType = 'ID Verified';
    } else if (verification.includes('phone') || verification === 'phone-verified') {
      score = 70;
      breakdown.verificationType = 'Phone Verified';
    } else if (verification.includes('email') || verification === 'email-verified') {
      score = 50;
      breakdown.verificationType = 'Email Verified';
    } else {
      score = 0;
      breakdown.verificationType = 'Not Verified';
    }

    // Bonuses (capped at 100)
    if (hasPhoto) {
      score = Math.min(100, score + 10);
      breakdown.profilePhoto = true;
    } else if (dataAvailability.profilePicture === 'platform_unavailable') {
      breakdown.profilePhoto = 'platform_unavailable';
    } else {
      breakdown.profilePhoto = false;
    }

    if (hasLocation) {
      score = Math.min(100, score + 10);
      breakdown.location = true;
    } else if (dataAvailability.location === 'platform_unavailable') {
      breakdown.location = 'platform_unavailable';
    } else {
      breakdown.location = false;
    }

    return {
      score: Math.min(100, score),
      available: true,
      breakdown
    };
  }

  /**
   * Category 2: Account Maturity (15%)
   * Measures: How old the account is
   */
  calculateAccountMaturityScore(sellerData) {
    const accountAgeMonths = sellerData.marketplaceData?.accountAge || 0;

    if (accountAgeMonths === 0) {
      return { score: null, available: false, breakdown: { months: 0, message: 'Account age not available' } };
    }

    let score = 0;
    if (accountAgeMonths >= 12) {
      score = 100;
    } else if (accountAgeMonths >= 6) {
      score = 70;
    } else if (accountAgeMonths >= 3) {
      score = 40;
    } else {
      score = 10;
    }

    return {
      score,
      available: true,
      breakdown: {
        months: accountAgeMonths,
        years: (accountAgeMonths / 12).toFixed(1)
      }
    };
  }

  /**
   * Category 3: Listing Completeness (15%)
   * Evaluates last 5 listings for: title, price, ≥3 photos, description ≥100 chars
   */
  calculateListingCompletenessScore(recentListings, sellerData = {}) {
    const dataAvailability = sellerData.dataAvailability || {};

    if (!recentListings || recentListings.length === 0) {
      const message = dataAvailability.recentListings === 'platform_unavailable'
        ? 'Listings not exposed by platform'
        : 'No listings available';

      return { score: null, available: false, breakdown: { message } };
    }

    const listingsToEvaluate = recentListings.slice(0, 5);
    let totalScore = 0;
    const evaluations = [];

    listingsToEvaluate.forEach(listing => {
      let listingScore = 0;
      const checks = {
        hasTitle: false,
        hasPrice: false,
        hasEnoughPhotos: false,
        hasGoodDescription: false
      };

      // Title present (5 points)
      if (listing.title && listing.title.length > 0) {
        listingScore += 5;
        checks.hasTitle = true;
      }

      // Price present (10 points)
      if (listing.price && listing.price.length > 0 && listing.hasPrice !== false) {
        listingScore += 10;
        checks.hasPrice = true;
      }

      // ≥3 photos (15 points) - Note: Currently we only detect 1 photo per listing
      // This will need enhancement when we can count all listing images
      if (listing.imageCount >= 3) {
        listingScore += 15;
        checks.hasEnoughPhotos = true;
      } else if (listing.imageCount >= 1) {
        listingScore += 5; // Partial credit for at least 1 photo
      }

      // Description ≥100 chars (20 points)
      if (listing.description && listing.descriptionLength >= 100) {
        listingScore += 20;
        checks.hasGoodDescription = true;
      }

      evaluations.push({
        title: listing.title,
        score: listingScore,
        checks
      });

      totalScore += listingScore;
    });

    // Average across listings and scale to 100
    const avgScore = totalScore / listingsToEvaluate.length;
    const normalizedScore = (avgScore / 50) * 100; // Max possible per listing is 50

    return {
      score: Math.round(Math.min(100, normalizedScore)),
      available: true,
      breakdown: {
        listingsEvaluated: listingsToEvaluate.length,
        averageListingScore: Math.round(avgScore),
        evaluations
      }
    };
  }

  /**
   * Category 4: Activity & Recency (10%)
   * Measures: How recently the seller has been active
   */
  calculateActivityRecencyScore(sellerData, recentListings) {
    // Check lastSeen (Jiji) or last listing date
    const lastSeenDays = sellerData.marketplaceData?.lastSeen;
    
    // If we have lastSeen data
    if (lastSeenDays !== null && lastSeenDays !== undefined) {
      const days = parseInt(lastSeenDays);
      
      if (days <= 7) {
        return { 
          score: 100, 
          available: true, 
          breakdown: { lastSeenDays: days, category: 'Very Active' } 
        };
      } else if (days <= 30) {
        return { 
          score: 70, 
          available: true, 
          breakdown: { lastSeenDays: days, category: 'Active' } 
        };
      } else if (days <= 60) {
        return { 
          score: 40, 
          available: true, 
          breakdown: { lastSeenDays: days, category: 'Moderately Active' } 
        };
      } else {
        return { 
          score: 10, 
          available: true, 
          breakdown: { lastSeenDays: days, category: 'Inactive' } 
        };
      }
    }

    // Fallback: Check if they have listings (means some activity)
    if (recentListings && recentListings.length > 0) {
      return { 
        score: 50, 
        available: true, 
        breakdown: { message: 'Has active listings', listings: recentListings.length } 
      };
    }

    const dataAvailability = sellerData.dataAvailability || {};
    const message = dataAvailability.recentListings === 'platform_unavailable'
      ? 'Platform does not expose activity signals'
      : 'Activity data not available';

    return { 
      score: null, 
      available: false, 
      breakdown: { message } 
    };
  }

  /**
   * Category 5: Engagement (Response Behavior) (10%)
   * Measures: How responsive the seller is
   */
  calculateEngagementScore(sellerData) {
    const responseRate = sellerData.marketplaceData?.responseRate;

    if (!responseRate || responseRate === 0) {
      return { 
        score: null, 
        available: false, 
        breakdown: { message: 'Response rate not available' } 
      };
    }

    let score = 0;
    if (responseRate >= 90) {
      score = 100;
    } else if (responseRate >= 80) {
      score = 80;
    } else if (responseRate >= 60) {
      score = 60;
    } else {
      score = 30;
    }

    return {
      score,
      available: true,
      breakdown: {
        responseRate: `${responseRate}%`
      }
    };
  }

  /**
   * Category 6: Community Feedback (10%)
   * Reviews from marketplace + Verible user feedback
   */
  calculateCommunityFeedbackScore(sellerData, veribleFeedback) {
    const totalReviews = sellerData.marketplaceData?.totalReviews || 0;
    const avgRating = sellerData.marketplaceData?.avgRating || 0;
    
    let score = 0;
    let breakdown = {
      marketplaceReviews: totalReviews,
      averageRating: avgRating
    };

    // Marketplace reviews
    if (totalReviews >= 10 || avgRating >= 4.5) {
      score = 100;
    } else if (totalReviews >= 5) {
      score = 70;
    } else if (totalReviews >= 1) {
      score = 40;
    } else {
      score = 0;
    }

    // Verible user feedback bonus
    if (veribleFeedback) {
      const endorsements = veribleFeedback.endorsements?.length || 0;
      const flags = veribleFeedback.flags?.length || 0;
      const netFeedback = endorsements - flags;

      breakdown.veribleEndorsements = endorsements;
      breakdown.veribleFlags = flags;
      breakdown.netFeedback = netFeedback;

      // Add bonus for positive Verible feedback (cap at 100)
      if (netFeedback > 0) {
        score = Math.min(100, score + (netFeedback * 5));
      } else if (netFeedback < 0) {
        score = Math.max(0, score + (netFeedback * 10)); // Flags hurt more
      }
    }

    // If no data at all, mark as N/A
    if (totalReviews === 0 && !veribleFeedback) {
      return {
        score: null,
        available: false,
        breakdown: { message: 'No feedback available' }
      };
    }

    return {
      score: Math.min(100, Math.max(0, score)),
      available: true,
      breakdown
    };
  }

  /**
   * Category 7: Behavioral Red Flags (15%)
   * Text analysis for suspicious patterns - START AT 100 and SUBTRACT penalties
   */
  calculateBehavioralRedFlagsScore(recentListings, sellerData = {}) {
    const dataAvailability = sellerData.dataAvailability || {};

    if (!recentListings || recentListings.length === 0) {
      const message = dataAvailability.recentListings === 'platform_unavailable'
        ? 'Platform does not expose listings for behavioral analysis'
        : 'No listings to analyze';

      return { 
        score: null, 
        available: false, 
        breakdown: { message } 
      };
    }

    let score = 100; // Start at 100
    const redFlags = [];
    const penalties = {
      urgent: 15,
      needMoneyAsap: 15,
      cashOnly: 20,
      firstComeFirstServe: 10,
      offPlatformContact: 20,
      allCapsTitle: 5,
      excessEmojis: 5
    };

    recentListings.forEach((listing, idx) => {
      const titleLower = (listing.title || '').toLowerCase();
      const descLower = (listing.description || '').toLowerCase();
      const fullText = `${titleLower} ${descLower}`;

      // Check for urgency keywords
      if (/urgent|asap|immediate|hurry/.test(fullText)) {
        score -= penalties.urgent;
        redFlags.push({ listing: idx + 1, flag: 'Urgent language', penalty: penalties.urgent });
      }

      // Need money ASAP
      if (/need money|bills|must sell|quick sale|fast sale/.test(fullText)) {
        score -= penalties.needMoneyAsap;
        redFlags.push({ listing: idx + 1, flag: 'Financial pressure language', penalty: penalties.needMoneyAsap });
      }

      // Cash only
      if (/cash only|payment first|no questions/.test(fullText)) {
        score -= penalties.cashOnly;
        redFlags.push({ listing: idx + 1, flag: 'Cash only / suspicious payment', penalty: penalties.cashOnly });
      }

      // First come first serve
      if (/first come|first serve/.test(fullText)) {
        score -= penalties.firstComeFirstServe;
        redFlags.push({ listing: idx + 1, flag: 'First come first serve', penalty: penalties.firstComeFirstServe });
      }

      // Off-platform contact (WhatsApp, Telegram, etc.)
      if (/whatsapp|telegram|contact me at|call.*\d{10}|text.*\d{10}/.test(fullText)) {
        score -= penalties.offPlatformContact;
        redFlags.push({ listing: idx + 1, flag: 'Off-platform contact attempt', penalty: penalties.offPlatformContact });
      }

      // ALL-CAPS title
      if (listing.title && listing.title === listing.title.toUpperCase() && listing.title.length > 5) {
        score -= penalties.allCapsTitle;
        redFlags.push({ listing: idx + 1, flag: 'ALL-CAPS title', penalty: penalties.allCapsTitle });
      }

      // Excess emojis (more than 3 in title or description)
      const emojiCount = (fullText.match(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu) || []).length;
      if (emojiCount > 3) {
        score -= penalties.excessEmojis;
        redFlags.push({ listing: idx + 1, flag: 'Excessive emojis', count: emojiCount, penalty: penalties.excessEmojis });
      }
    });

    return {
      score: Math.max(0, score),
      available: true,
      breakdown: {
        startScore: 100,
        redFlagsFound: redFlags.length,
        redFlags,
        finalScore: Math.max(0, score)
      }
    };
  }

  /**
   * Calculate confidence score (0.00 - 1.00)
   * Components: Coverage (50%), Recency (30%), Consistency (20%)
   */
  calculateConfidence(sellerData, recentListings, categories) {
    // 1. Coverage: How many categories have valid data
    const totalCategories = Object.keys(categories).length;
    const availableCategories = Object.values(categories).filter(c => c.available).length;
    const coverage = availableCategories / totalCategories;

    // 2. Recency: Based on activity
    const lastSeenDays = sellerData.marketplaceData?.lastSeen;
    let recency = 0.3; // Default low
    if (lastSeenDays !== null && lastSeenDays !== undefined) {
      const days = parseInt(lastSeenDays);
      if (days <= 30) {
        recency = 1.0;
      } else if (days <= 60) {
        recency = 0.6;
      } else {
        recency = 0.3;
      }
    } else if (recentListings && recentListings.length > 0) {
      recency = 0.6; // Some activity
    }

    // 3. Consistency: Check for contradictory fields
    let consistency = 1.0;
    const hasBusinessIndicators = (sellerData.profileData?.bio || '').toLowerCase().includes('we supply') ||
                                   (sellerData.profileData?.bio || '').toLowerCase().includes('we sell');
    const hasBasicIdentity = categories.verificationIdentity.score > 0;

    if (hasBusinessIndicators && !hasBasicIdentity) {
      consistency = 0.7; // Business but no basic identity verification
    }

    // Calculate final confidence
    const confidence = (0.5 * coverage) + (0.3 * recency) + (0.2 * consistency);

    return {
      confidence: Math.round(confidence * 100) / 100,
      coverage: Math.round(coverage * 100) / 100,
      recency: Math.round(recency * 100) / 100,
      consistency: Math.round(consistency * 100) / 100,
      availableCategories,
      totalCategories,
      missingCategories: Object.keys(categories).filter(key => !categories[key].available)
    };
  }

  /**
   * Calculate final score with reweighting for N/A categories
   */
  calculateFinalScore(categories) {
    let totalWeight = 0;
    let weightedSum = 0;
    const normalizedWeights = {};

    // Calculate total weight of available categories
    Object.keys(categories).forEach(key => {
      if (categories[key].available && categories[key].score !== null) {
        totalWeight += this.categoryWeights[key];
      }
    });

    // If no categories available, return 0
    if (totalWeight === 0) {
      return { finalScore: 0, normalizedWeights: {} };
    }

    // Calculate weighted score with renormalization
    Object.keys(categories).forEach(key => {
      if (categories[key].available && categories[key].score !== null) {
        const normalizedWeight = this.categoryWeights[key] / totalWeight;
        normalizedWeights[key] = Math.round(normalizedWeight * 100);
        weightedSum += categories[key].score * normalizedWeight;
      } else {
        normalizedWeights[key] = 0;
      }
    });

    return {
      finalScore: Math.round(weightedSum),
      normalizedWeights
    };
  }

  /**
   * Generate recommendations based on score
   */
  generateRecommendations(finalScore, categories) {
    const recommendations = [];

    // Overall recommendation
    if (finalScore >= 80) {
      recommendations.push({
        type: 'positive',
        priority: 'high',
        message: 'Highly trustworthy seller with excellent verification and track record',
        action: 'Safe to Purchase'
      });
    } else if (finalScore >= 60) {
      recommendations.push({
        type: 'positive',
        priority: 'medium',
        message: 'Good trust indicators with minor concerns',
        action: 'Consider for Purchase'
      });
    } else if (finalScore >= 40) {
      recommendations.push({
        type: 'warning',
        priority: 'high',
        message: 'Mixed trust indicators - proceed with caution',
        action: 'Review Carefully Before Purchase'
      });
    } else {
      recommendations.push({
        type: 'negative',
        priority: 'critical',
        message: 'Low trust score - high risk transaction',
        action: 'Avoid or Request Additional Verification'
      });
    }

    // Category-specific recommendations
    if (categories.verificationIdentity.available && categories.verificationIdentity.score < 50) {
      recommendations.push({
        type: 'warning',
        priority: 'high',
        message: 'Seller is not verified - identity cannot be confirmed',
        action: 'Request verification before proceeding'
      });
    }

    if (categories.behavioralRedFlags.available && categories.behavioralRedFlags.score < 70) {
      recommendations.push({
        type: 'warning',
        priority: 'critical',
        message: 'Multiple red flags detected in listings (urgency, suspicious payment requests)',
        action: 'Exercise extreme caution or avoid'
      });
    }

    if (categories.communityFeedback.available && categories.communityFeedback.score < 40) {
      recommendations.push({
        type: 'warning',
        priority: 'medium',
        message: 'Limited or poor community feedback',
        action: 'Check reviews carefully'
      });
    }

    return recommendations;
  }

  /**
   * Determine trust level label
   */
  determineTrustLevel(score) {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    if (score >= 20) return 'Poor';
    return 'Very Poor';
  }

  /**
   * Get confidence level label
   */
  getConfidenceLabel(confidence) {
    if (confidence >= 0.80) return 'Very High';
    if (confidence >= 0.60) return 'High';
    if (confidence >= 0.40) return 'Medium';
    if (confidence >= 0.20) return 'Low';
    return 'Very Low';
  }

  /**
   * Identify risk factors
   */
  identifyRiskFactors(categories) {
    const risks = [];

    if (categories.verificationIdentity.available && categories.verificationIdentity.score < 30) {
      risks.push({
        category: 'Verification & Identity',
        severity: 'high',
        issue: 'Unverified seller identity'
      });
    }

    if (categories.accountMaturity.available && categories.accountMaturity.score < 40) {
      risks.push({
        category: 'Account Maturity',
        severity: 'medium',
        issue: 'Very new account (less than 3 months)'
      });
    }

    if (categories.behavioralRedFlags.available && categories.behavioralRedFlags.score < 70) {
      risks.push({
        category: 'Behavioral Red Flags',
        severity: 'critical',
        issue: 'Suspicious language patterns detected'
      });
    }

    if (categories.communityFeedback.available && categories.communityFeedback.score < 40) {
      risks.push({
        category: 'Community Feedback',
        severity: 'medium',
        issue: 'Poor or insufficient reviews'
      });
    }

    return risks;
  }

  /**
   * Identify strength areas
   */
  identifyStrengths(categories) {
    const strengths = [];

    Object.keys(categories).forEach(key => {
      if (categories[key].available && categories[key].score >= 80) {
        strengths.push({
          category: key,
          score: categories[key].score,
          message: this.getStrengthMessage(key, categories[key].score)
        });
      }
    });

    return strengths;
  }

  /**
   * Get strength message for category
   */
  getStrengthMessage(category, score) {
    const messages = {
      verificationIdentity: 'Fully verified identity with complete profile',
      accountMaturity: 'Well-established account with long history',
      listingCompleteness: 'High-quality, detailed listings',
      activityRecency: 'Very active and responsive seller',
      engagement: 'Excellent response rate to buyers',
      communityFeedback: 'Strong positive feedback from buyers',
      behavioralRedFlags: 'No suspicious behavior detected'
    };

    return messages[category] || 'Strong performance in this area';
  }
}

export default new PulseScoringService();
