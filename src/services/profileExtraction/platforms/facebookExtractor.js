import { parseAccountAge, parseNumber, parseRating } from '../utils/parser.js';

export function extractFacebookProfile(scrapedData, url) {
  const { markdown } = scrapedData;

  return {
    platform: 'facebook',
    profileUrl: url,
    profileData: {
      name: extractFacebookNameFromMarkdown(markdown),
      profilePicture: extractFacebookProfilePictureFromMarkdown(markdown),
      location: extractFacebookLocationFromMarkdown(markdown),
      bio: extractFacebookBioFromMarkdown(markdown)
    },
    marketplaceData: {
      accountAge: extractFacebookAccountAgeFromMarkdown(markdown),
      totalListings: extractFacebookTotalListingsFromMarkdown(markdown),
      avgRating: extractFacebookRatingFromMarkdown(markdown),
      totalReviews: extractFacebookReviewsFromMarkdown(markdown),
      responseRate: extractFacebookResponseRateFromMarkdown(markdown),
      verificationStatus: extractFacebookVerificationFromMarkdown(markdown)
    },
    recentListings: extractFacebookRecentListingsFromMarkdown(markdown),
    trustIndicators: extractFacebookTrustIndicatorsFromMarkdown(markdown)
  };
}

function extractFacebookNameFromMarkdown(markdown) {
  const nameMatch =
    markdown.match(/#\s*([^#\n]+)/) ||
    markdown.match(/\*\*([^*]+)\*\*/) ||
    markdown.match(/^([^#\n]+)$/m);

  return nameMatch ? nameMatch[1].trim() : 'Unknown';
}

function extractFacebookProfilePictureFromMarkdown(markdown) {
  const imageMatch = markdown.match(/!\[.*?\]\((https?:\/\/[^)]+\.(jpg|jpeg|png|gif|webp))/i);
  return imageMatch ? imageMatch[1] : null;
}

function extractFacebookLocationFromMarkdown(markdown) {
  const locationMatch =
    markdown.match(/(?:location|lives in|from)[:\s]+([^#\n]+)/i) ||
    markdown.match(/📍\s*([^#\n]+)/i);

  return locationMatch ? locationMatch[1].trim() : 'Not specified';
}

function extractFacebookBioFromMarkdown(markdown) {
  const bioMatch =
    markdown.match(/(?:about|bio)[:\s]+([^#\n]+)/i) || markdown.match(/📝\s*([^#\n]+)/i);

  return bioMatch ? bioMatch[1].trim() : '';
}

function extractFacebookAccountAgeFromMarkdown(markdown) {
  const ageMatch =
    markdown.match(/(?:member since|joined|account age)[:\s]+([^#\n]+)/i) ||
    markdown.match(/(\d+)\s*(?:year|month)/i);

  return parseAccountAge(ageMatch ? ageMatch[1] : '');
}

function extractFacebookTotalListingsFromMarkdown(markdown) {
  const listingsMatch =
    markdown.match(/(?:listings|items|products)[:\s]+(\d+)/i) ||
    markdown.match(/(\d+)\s*(?:listings|items|products)/i);

  return parseNumber(listingsMatch ? listingsMatch[1] : '');
}

function extractFacebookRatingFromMarkdown(markdown) {
  const ratingMatch =
    markdown.match(/(?:rating|stars)[:\s]+(\d+\.?\d*)/i) ||
    markdown.match(/(\d+\.?\d*)\s*(?:stars?|rating)/i);

  return parseRating(ratingMatch ? ratingMatch[1] : '');
}

function extractFacebookReviewsFromMarkdown(markdown) {
  const reviewsMatch =
    markdown.match(/(?:reviews|feedback)[:\s]+(\d+)/i) ||
    markdown.match(/(\d+)\s*(?:reviews?|feedback)/i);

  return parseNumber(reviewsMatch ? reviewsMatch[1] : '');
}

function extractFacebookResponseRateFromMarkdown(markdown) {
  const percentMatch =
    markdown.match(/(?:response rate|responds)[:\s]+(\d+)%/i) ||
    markdown.match(/(\d+)%\s*(?:response rate|response)/i);

  if (percentMatch && percentMatch[1]) {
    return parseInt(percentMatch[1], 10);
  }

  const replyTimeMatch =
    markdown.match(/typically replies within\s+(?:a\s+)?(\w+)/i) ||
    markdown.match(/usually responds within\s+(?:a\s+)?(\w+)/i) ||
    markdown.match(/responds in\s+(?:a\s+)?(\w+)/i);

  if (replyTimeMatch && replyTimeMatch[1]) {
    const timeUnit = replyTimeMatch[1].toLowerCase();

    if (timeUnit.includes('minute') || timeUnit.includes('hour')) {
      return 95;
    }
    if (timeUnit.includes('day')) {
      return 80;
    }
    if (timeUnit.includes('week')) {
      return 50;
    }
  }

  const lowerMarkdown = markdown.toLowerCase();
  if (lowerMarkdown.includes('very responsive') || lowerMarkdown.includes('highly responsive')) {
    return 95;
  }
  if (lowerMarkdown.includes('responsive')) {
    return 85;
  }

  return 0;
}

function extractFacebookVerificationFromMarkdown(markdown) {
  const lowerMarkdown = markdown.toLowerCase();

  if (
    lowerMarkdown.includes('id verified') ||
    lowerMarkdown.includes('identity verified') ||
    lowerMarkdown.includes('id confirmed')
  ) {
    return 'id-verified';
  }

  if (
    lowerMarkdown.includes('phone verified') ||
    lowerMarkdown.includes('phone number verified')
  ) {
    return 'phone-verified';
  }

  if (lowerMarkdown.includes('email verified') || lowerMarkdown.includes('email confirmed')) {
    return 'email-verified';
  }

  if (
    lowerMarkdown.includes('verified seller') ||
    lowerMarkdown.includes('verified user') ||
    lowerMarkdown.includes('✓') ||
    lowerMarkdown.includes('verified badge')
  ) {
    return 'verified';
  }

  return 'unverified';
}

function extractFacebookRecentListingsFromMarkdown(markdown) {
  const listings = [];
  const listingPattern =
    /\$\s*([\d,]+|[Ff]ree)[^$\n]*?([A-Z][^\n]{10,80})[^\n]*?\n([^\n]{20,150})/g;

  let match;
  let count = 0;

  while ((match = listingPattern.exec(markdown)) !== null && count < 5) {
    const price = match[1] ? match[1].trim() : '';
    const title = match[2] ? match[2].trim() : '';
    const description = match[3] ? match[3].trim() : '';

    listings.push({
      title,
      price: price === 'Free' || price === 'free' ? '0' : price.replace(/,/g, ''),
      imageCount: 1,
      description,
      hasPrice: price !== '',
      descriptionLength: description.length
    });

    count += 1;
  }

  if (listings.length === 0) {
    const simpleMatches = markdown.match(/(?:title|item|product)[:\s]+([^#\n]+)/gi);

    if (simpleMatches) {
      simpleMatches.slice(0, 5).forEach(item => {
        const title = item.replace(/(?:title|item|product)[:\s]+/i, '').trim();
        if (title && title.length > 5) {
          listings.push({
            title,
            price: '',
            imageCount: 1,
            description: '',
            hasPrice: false,
            descriptionLength: 0
          });
        }
      });
    }
  }

  return listings;
}

function extractFacebookTrustIndicatorsFromMarkdown(markdown) {
  return {
    hasProfilePicture: !!extractFacebookProfilePictureFromMarkdown(markdown),
    hasLocation: extractFacebookLocationFromMarkdown(markdown) !== 'Not specified',
    hasBio: extractFacebookBioFromMarkdown(markdown).length > 0,
    accountAge: extractFacebookAccountAgeFromMarkdown(markdown),
    totalReviews: extractFacebookReviewsFromMarkdown(markdown),
    avgRating: extractFacebookRatingFromMarkdown(markdown),
    verificationStatus: extractFacebookVerificationFromMarkdown(markdown)
  };
}

