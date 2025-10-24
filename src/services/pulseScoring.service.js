import Listing from '../models/Listing.model.js';

/**
 * Pulse Scoring Engine
 * Calculates trust scores based on seller data and marketplace behavior
 */
class PulseScoringService {
  constructor() {
    this.baseScore = 50; // Starting score
    this.maxScore = 100;
    this.minScore = 0;
  }

  /**
   * Calculate pulse score for a seller
   * @param {Object} sellerData - Extracted seller data
   * @param {Array} recentListings - Recent listings data
   * @returns {Object} Score breakdown and final score
   */
  async calculatePulseScore(sellerData, recentListings = []) {
    try {
      const scoringFactors = {
        accountAge: this.calculateAccountAgeScore(sellerData.marketplaceData?.accountAge || 0),
        profileCompleteness: this.calculateProfileCompletenessScore(sellerData),
        verificationStatus: this.calculateVerificationScore(sellerData.marketplaceData?.verificationStatus),
        ratingScore: this.calculateRatingScore(sellerData.marketplaceData?.avgRating || 0),
        reviewCount: this.calculateReviewCountScore(sellerData.marketplaceData?.totalReviews || 0),
        responseRate: this.calculateResponseRateScore(sellerData.marketplaceData?.responseRate || 0),
        listingQuality: this.calculateListingQualityScore(recentListings),
        urgencyScore: this.calculateUrgencyScore(recentListings),
        activityScore: this.calculateActivityScore(sellerData.marketplaceData?.totalListings || 0)
      };

      // Calculate weighted final score
      const weights = {
        accountAge: 0.15,
        profileCompleteness: 0.10,
        verificationStatus: 0.20,
        ratingScore: 0.15,
        reviewCount: 0.10,
        responseRate: 0.05,
        listingQuality: 0.10,
        urgencyScore: 0.10,
        activityScore: 0.05
      };

      let finalScore = this.baseScore;
      let totalWeight = 0;

      Object.keys(scoringFactors).forEach(factor => {
        const weight = weights[factor] || 0;
        const score = scoringFactors[factor];
        finalScore += (score * weight);
        totalWeight += weight;
      });

      // Normalize score
      finalScore = Math.max(this.minScore, Math.min(this.maxScore, Math.round(finalScore)));

      // Determine confidence level
      const confidenceLevel = this.calculateConfidenceLevel(sellerData, recentListings);

      // Generate trust recommendations
      const recommendations = this.generateRecommendations(finalScore, scoringFactors);

      return {
        pulseScore: finalScore,
        confidenceLevel,
        scoringFactors,
        recommendations,
        trustIndicators: this.generateTrustIndicators(scoringFactors),
        riskFactors: this.identifyRiskFactors(scoringFactors)
      };
    } catch (error) {
      console.error('Pulse scoring error:', error);
      throw new Error(`Failed to calculate pulse score: ${error.message}`);
    }
  }

  /**
   * Calculate account age score (0-100)
   */
  calculateAccountAgeScore(accountAgeMonths) {
    if (accountAgeMonths >= 24) return 100; // 2+ years
    if (accountAgeMonths >= 12) return 80;  // 1+ year
    if (accountAgeMonths >= 6) return 60;   // 6+ months
    if (accountAgeMonths >= 3) return 40;   // 3+ months
    if (accountAgeMonths >= 1) return 20;   // 1+ month
    return 0; // Less than 1 month
  }

  /**
   * Calculate profile completeness score (0-100)
   */
  calculateProfileCompletenessScore(sellerData) {
    let score = 0;
    const factors = [
      { check: sellerData.profileData?.name && sellerData.profileData.name !== 'Unknown', weight: 20 },
      { check: !!sellerData.profileData?.profilePicture, weight: 20 },
      { check: sellerData.profileData?.location && sellerData.profileData.location !== 'Not specified', weight: 20 },
      { check: sellerData.profileData?.bio && sellerData.profileData.bio.length > 10, weight: 20 },
      { check: sellerData.marketplaceData?.totalListings > 0, weight: 20 }
    ];

    factors.forEach(factor => {
      if (factor.check) score += factor.weight;
    });

    return score;
  }

  /**
   * Calculate verification score (0-100)
   */
  calculateVerificationScore(verificationStatus) {
    switch (verificationStatus?.toLowerCase()) {
      case 'id-verified':
      case 'identity verified':
        return 100;
      case 'phone-verified':
      case 'phone verified':
        return 80;
      case 'email-verified':
      case 'email verified':
        return 60;
      case 'unverified':
      default:
        return 0;
    }
  }

  /**
   * Calculate rating score (0-100)
   */
  calculateRatingScore(avgRating) {
    if (avgRating >= 4.5) return 100;
    if (avgRating >= 4.0) return 80;
    if (avgRating >= 3.5) return 60;
    if (avgRating >= 3.0) return 40;
    if (avgRating >= 2.5) return 20;
    return 0;
  }

  /**
   * Calculate review count score (0-100)
   */
  calculateReviewCountScore(totalReviews) {
    if (totalReviews >= 100) return 100;
    if (totalReviews >= 50) return 80;
    if (totalReviews >= 20) return 60;
    if (totalReviews >= 10) return 40;
    if (totalReviews >= 5) return 20;
    return 0;
  }

  /**
   * Calculate response rate score (0-100)
   */
  calculateResponseRateScore(responseRate) {
    if (responseRate >= 90) return 100;
    if (responseRate >= 80) return 80;
    if (responseRate >= 70) return 60;
    if (responseRate >= 60) return 40;
    if (responseRate >= 50) return 20;
    return 0;
  }

  /**
   * Calculate listing quality score (0-100)
   */
  calculateListingQualityScore(recentListings) {
    if (!recentListings || recentListings.length === 0) return 0;

    let score = 0;
    const factors = [
      { check: recentListings.some(listing => listing.title && listing.title.length > 10), weight: 30 },
      { check: recentListings.some(listing => listing.price && !isNaN(listing.price)), weight: 30 },
      { check: recentListings.length >= 3, weight: 20 },
      { check: recentListings.some(listing => listing.date), weight: 20 }
    ];

    factors.forEach(factor => {
      if (factor.check) score += factor.weight;
    });

    return score;
  }


  /**
   * Calculate urgency score (0-100, higher = more suspicious)
   */
  calculateUrgencyScore(recentListings) {
    if (!recentListings || recentListings.length === 0) return 0;

    console.log('⚡ Analyzing urgency patterns...');

    const urgencyKeywords = [
      // High urgency (scam indicators)
      'urgent', 'asap', 'immediate', 'quick', 'emergency',
      'need money', 'bills', 'first come', 'hurry',
      'payment first', 'cash only', 'no questions',
      'must sell', 'quick sale', 'fast sale',
      
      // Medium urgency
      'selling fast', 'limited time', 'offer ends',
      'contact now', 'call now', 'text now',
      
      // Low urgency (normal selling)
      'for sale', 'available', 'in stock'
    ];

    const highUrgencyKeywords = urgencyKeywords.slice(0, 12);
    const mediumUrgencyKeywords = urgencyKeywords.slice(12, 18);
    const lowUrgencyKeywords = urgencyKeywords.slice(18);

    let urgencyScore = 0;
    let urgencyReasons = [];
    let totalListings = recentListings.length;
    let highUrgencyCount = 0;
    let mediumUrgencyCount = 0;
    let lowUrgencyCount = 0;

    recentListings.forEach((listing, index) => {
      const text = `${listing.title} ${listing.description || ''}`.toLowerCase();
      let listingUrgency = 0;
      let foundKeywords = [];

      // Check for high urgency keywords
      highUrgencyKeywords.forEach(keyword => {
        if (text.includes(keyword)) {
          listingUrgency += 15;
          foundKeywords.push(keyword);
        }
      });

      // Check for medium urgency keywords
      mediumUrgencyKeywords.forEach(keyword => {
        if (text.includes(keyword)) {
          listingUrgency += 8;
          foundKeywords.push(keyword);
        }
      });

      // Check for low urgency keywords
      lowUrgencyKeywords.forEach(keyword => {
        if (text.includes(keyword)) {
          listingUrgency += 2;
          foundKeywords.push(keyword);
        }
      });

      if (listingUrgency > 0) {
        urgencyScore += Math.min(20, listingUrgency);
        
        if (listingUrgency >= 15) highUrgencyCount++;
        else if (listingUrgency >= 8) mediumUrgencyCount++;
        else lowUrgencyCount++;

        if (index < 3) { // Log first 3 listings for debugging
          console.log(`📝 Listing ${index + 1}: "${listing.title}" - Urgency: ${listingUrgency}, Keywords: [${foundKeywords.join(', ')}]`);
        }
      }
    });

    // Additional urgency patterns
    const urgencyPercentage = (highUrgencyCount + mediumUrgencyCount) / totalListings;
    if (urgencyPercentage > 0.5) {
      urgencyScore += 25;
      urgencyReasons.push(`High urgency percentage: ${Math.round(urgencyPercentage * 100)}% of listings`);
    }

    if (highUrgencyCount > totalListings * 0.3) {
      urgencyScore += 30;
      urgencyReasons.push(`Too many high urgency listings: ${highUrgencyCount}/${totalListings}`);
    }

    console.log('⚡ Urgency analysis:', {
      urgencyScore,
      totalListings,
      highUrgencyCount,
      mediumUrgencyCount,
      lowUrgencyCount,
      urgencyPercentage: Math.round(urgencyPercentage * 100),
      reasons: urgencyReasons
    });

    return Math.min(100, urgencyScore);
  }

  /**
   * Calculate activity score (0-100)
   */
  calculateActivityScore(totalListings) {
    if (totalListings >= 50) return 100;
    if (totalListings >= 20) return 80;
    if (totalListings >= 10) return 60;
    if (totalListings >= 5) return 40;
    if (totalListings >= 1) return 20;
    return 0;
  }

  /**
   * Calculate confidence level
   */
  calculateConfidenceLevel(sellerData, recentListings) {
    let confidenceScore = 0;
    
    // Data completeness factors
    if (sellerData.profileData?.name) confidenceScore += 20;
    if (sellerData.profileData?.profilePicture) confidenceScore += 15;
    if (sellerData.profileData?.location) confidenceScore += 15;
    if (sellerData.marketplaceData?.accountAge > 0) confidenceScore += 20;
    if (sellerData.marketplaceData?.totalReviews > 0) confidenceScore += 15;
    if (recentListings && recentListings.length > 0) confidenceScore += 15;

    if (confidenceScore >= 80) return 'high';
    if (confidenceScore >= 50) return 'medium';
    return 'low';
  }

  /**
   * Generate trust recommendations
   */
  generateRecommendations(pulseScore, scoringFactors) {
    const recommendations = [];

    if (pulseScore >= 80) {
      recommendations.push({
        type: 'positive',
        message: 'High trust score indicates reliable seller with excellent track record',
        action: 'Safe to Purchase'
      });
    } else if (pulseScore >= 60) {
      recommendations.push({
        type: 'positive',
        message: 'Good trust indicators with minor concerns',
        action: 'Consider for Purchase'
      });
    } else if (pulseScore >= 40) {
      recommendations.push({
        type: 'warning',
        message: 'Mixed trust indicators - proceed with caution',
        action: 'Review Before Purchase'
      });
    } else {
      recommendations.push({
        type: 'negative',
        message: 'Low trust score - high risk transaction',
        action: 'Avoid or Request Additional Verification'
      });
    }

    // Add specific recommendations based on scoring factors
    if (scoringFactors.verificationStatus < 50) {
      recommendations.push({
        type: 'warning',
        message: 'Unverified seller - request additional verification before purchase',
        action: 'Request Verification'
      });
    }

    if (scoringFactors.ratingScore < 60) {
      recommendations.push({
        type: 'warning',
        message: 'Poor ratings or insufficient reviews - high transaction risk',
        action: 'Review Feedback History'
      });
    }

    return recommendations;
  }

  /**
   * Generate trust indicators
   */
  generateTrustIndicators(scoringFactors) {
    return {
      accountVerification: `${scoringFactors.verificationStatus}%`,
      transactionHistory: `${scoringFactors.reviewCount}%`,
      communicationQuality: `${scoringFactors.responseRate}%`,
      disputeResolution: `${scoringFactors.ratingScore}%`
    };
  }

  /**
   * Identify risk factors
   */
  identifyRiskFactors(scoringFactors) {
    const riskFactors = [];

    if (scoringFactors.priceAnomaly > 50) {
      riskFactors.push('Suspicious pricing patterns detected');
    }

    if (scoringFactors.urgencyScore > 30) {
      riskFactors.push('High urgency language in listings');
    }

    if (scoringFactors.verificationStatus < 30) {
      riskFactors.push('Unverified seller identity');
    }

    if (scoringFactors.ratingScore < 40) {
      riskFactors.push('Poor customer ratings');
    }

    return riskFactors;
  }

  /**
   * Extract numeric price from price string
   */
  extractPrice(priceString) {
    if (!priceString) return 0;
    const match = priceString.match(/[\d,]+/);
    return match ? parseInt(match[0].replace(/,/g, '')) : 0;
  }
}

export default new PulseScoringService();
