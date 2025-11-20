export function determineTrustLevel(pulseScore) {
  if (pulseScore >= 80) return 'Very High Trust';
  if (pulseScore >= 65) return 'Medium Trust';
  if (pulseScore >= 40) return 'Low Trust';
  return 'High Risk';
}

export function assessRiskLevel(pulseScore, flagCount) {
  if (pulseScore >= 70 && flagCount === 0) return 'Low Risk';
  if (pulseScore >= 50 && flagCount < 3) return 'Medium Risk';
  if (pulseScore >= 30 || flagCount >= 3) return 'High Risk';
  return 'Very High Risk';
}

export function generateAnalysisRecommendations(seller) {
  const recommendations = [];

  if (seller.pulseScore >= 80) {
    recommendations.push({
      type: 'positive',
      message: 'Highly recommended seller with excellent track record',
      action: 'Safe to transact'
    });
  } else if (seller.pulseScore >= 65) {
    recommendations.push({
      type: 'positive',
      message: 'Good seller with minor concerns',
      action: 'Proceed with caution'
    });
  } else if (seller.pulseScore >= 40) {
    recommendations.push({
      type: 'warning',
      message: 'Mixed indicators - review carefully',
      action: 'Request additional verification'
    });
  } else {
    recommendations.push({
      type: 'negative',
      message: 'High risk seller - avoid transaction',
      action: 'Do not proceed'
    });
  }

  if (seller.flags.length > 0) {
    recommendations.push({
      type: 'warning',
      message: `${seller.flags.length} flags reported against this seller`,
      action: 'Review flag details before proceeding'
    });
  }

  if (seller.verificationStatus === 'unverified') {
    recommendations.push({
      type: 'warning',
      message: 'Unverified seller identity',
      action: 'Request identity verification'
    });
  }

  return recommendations;
}

