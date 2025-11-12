import { parseNumber, parseRating, parsePercentage } from '../utils/parser.js';

export function extractJijiProfile(scrapedData, url) {
  const { markdown } = scrapedData;

  return {
    platform: 'jiji',
    profileUrl: url,
    profileData: {
      name: extractJijiNameFromMarkdown(markdown),
      profilePicture: extractJijiProfilePictureFromMarkdown(markdown),
      location: extractJijiLocationFromMarkdown(markdown),
      bio: extractJijiBioFromMarkdown(markdown)
    },
    marketplaceData: {
      accountAge: extractJijiAccountAgeFromMarkdown(markdown),
      totalListings: extractJijiTotalListingsFromMarkdown(markdown),
      avgRating: extractJijiRatingFromMarkdown(markdown),
      totalReviews: extractJijiReviewsFromMarkdown(markdown),
      responseRate: extractJijiResponseRateFromMarkdown(markdown),
      verificationStatus: extractJijiVerificationFromMarkdown(markdown),
      lastSeen: extractJijiLastSeenFromMarkdown(markdown),
      followers: extractJijiFollowersFromMarkdown(markdown),
      categories: extractJijiCategoriesFromMarkdown(markdown)
    },
    recentListings: extractJijiRecentListingsFromMarkdown(markdown),
    trustIndicators: extractJijiTrustIndicatorsFromMarkdown(markdown)
  };
}

function extractJijiNameFromMarkdown(markdown) {
  const nameMatch = markdown.match(
    /!\[\]\(https:\/\/pictures-nigeria\.jijistatic\.net\/[^\)]+\)\s*\n\s*([^\n]+)\s*\n\s*\d+\+?\s*years?\s+on\s+Jiji/i
  );

  if (nameMatch && nameMatch[1]) {
    return nameMatch[1].trim();
  }

  const searchMatch = markdown.match(/Search in adverts of ([^\n]+)/i);
  if (searchMatch && searchMatch[1]) {
    return searchMatch[1].trim();
  }

  return 'Unknown';
}

function extractJijiProfilePictureFromMarkdown(markdown) {
  const imageMatch = markdown.match(/!\[.*?\]\((https?:\/\/[^)]+\.(jpg|jpeg|png|gif|webp))/i);
  return imageMatch ? imageMatch[1] : null;
}

function extractJijiLocationFromMarkdown() {
  return 'Not specified';
}

function extractJijiBioFromMarkdown(markdown) {
  const bioMatch = markdown.match(/About seller\s*\n\s*([^\n]+(?:\n[^\n]+)*?)(?=\n\n|\n\d+ads|$)/i);

  if (bioMatch && bioMatch[1]) {
    return bioMatch[1].trim();
  }

  return '';
}

function extractJijiAccountAgeFromMarkdown(markdown) {
  const ageMatch = markdown.match(/(\d+)\+?\s*years?\s+on\s+Jiji/i);

  if (ageMatch && ageMatch[1]) {
    return parseInt(ageMatch[1], 10) * 12;
  }

  const monthsMatch = markdown.match(/(\d+)\s*months?\s+on\s+Jiji/i);
  if (monthsMatch && monthsMatch[1]) {
    return parseInt(monthsMatch[1], 10);
  }

  return 0;
}

function extractJijiTotalListingsFromMarkdown(markdown) {
  const adsMatch = markdown.match(/(\d+)ads/i);

  if (adsMatch && adsMatch[1]) {
    return parseInt(adsMatch[1], 10);
  }

  const listingsMatch =
    markdown.match(/(?:listings|ads|items|products)[:\s]+(\d+)/i) ||
    markdown.match(/(\d+)\s*(?:listings|ads|items|products)/i);

  return parseNumber(listingsMatch ? listingsMatch[1] : '');
}

function extractJijiRatingFromMarkdown(markdown) {
  const ratingMatch =
    markdown.match(/(?:rating|stars)[:\s]+(\d+\.?\d*)/i) ||
    markdown.match(/(\d+\.?\d*)\s*(?:stars?|rating)/i);

  return parseRating(ratingMatch ? ratingMatch[1] : '');
}

function extractJijiReviewsFromMarkdown(markdown) {
  const reviewsMatch =
    markdown.match(/(?:reviews|feedback)[:\s]+(\d+)/i) ||
    markdown.match(/(\d+)\s*(?:reviews?|feedback)/i) ||
    markdown.match(/feedback\s*\((\d+)\)/i);

  return parseNumber(reviewsMatch ? reviewsMatch[1] : '');
}

function extractJijiResponseRateFromMarkdown(markdown) {
  const responseMatch =
    markdown.match(/(?:response rate|response)[:\s]+(\d+)%/i) ||
    markdown.match(/(\d+)%\s*(?:response rate|response)/i);

  return parsePercentage(responseMatch ? responseMatch[1] : '');
}

function extractJijiVerificationFromMarkdown(markdown) {
  if (markdown.match(/(?:verified id|verified)/i)) {
    return 'id-verified';
  }
  if (markdown.match(/(?:verified|verification)/i)) {
    return 'verified';
  }
  return 'unverified';
}

function extractJijiRecentListingsFromMarkdown(markdown) {
  const listings = [];
  const listingPattern =
    /!\[Photo - ([^\]]+)\]\(([^\)]+)\)[^\₦]*₦\s*([\d,]+|Contact for price)[^\\]*\\[^\\]*\\([^\\]+)\\[^\\]*\\([^\\]+)/g;

  let match;
  let count = 0;

  while ((match = listingPattern.exec(markdown)) !== null && count < 5) {
    const titleFromAlt = match[1] ? match[1].trim() : '';
    const price = match[3] ? match[3].trim() : '';
    const title = match[4] ? match[4].trim() : titleFromAlt;
    const description = match[5] ? match[5].trim() : '';

    listings.push({
      title: title || titleFromAlt,
      price: price === 'Contact for price' ? '' : price.replace(/,/g, ''),
      imageCount: 1,
      description,
      hasPrice: price !== 'Contact for price',
      descriptionLength: description.length
    });

    count += 1;
  }

  return listings;
}

function extractJijiLastSeenFromMarkdown(markdown) {
  const lastSeenMatch = markdown.match(/Last seen (\d+)\s*(hour|day|minute)s?\s+ago/i);

  if (lastSeenMatch && lastSeenMatch[1] && lastSeenMatch[2]) {
    const value = parseInt(lastSeenMatch[1], 10);
    const unit = lastSeenMatch[2].toLowerCase();

    if (unit === 'minute') {
      return '0';
    }
    if (unit === 'hour') {
      return value < 24 ? '0' : Math.floor(value / 24).toString();
    }
    if (unit === 'day') {
      return value.toString();
    }
  }

  return null;
}

function extractJijiFollowersFromMarkdown(markdown) {
  const followersMatch =
    markdown.match(/(?:followers|following)[:\s]+(\d+)/i) ||
    markdown.match(/(\d+)\s*(?:followers?|following)/i);

  return parseNumber(followersMatch ? followersMatch[1] : '');
}

function extractJijiCategoriesFromMarkdown(markdown) {
  const categories = [];
  const categoryMatches = markdown.match(/(?:category|categories)[:\s]+([^#\n]+)/gi);

  if (categoryMatches) {
    categoryMatches.forEach(match => {
      const categoryText = match.replace(/(?:category|categories)[:\s]+/i, '').trim();
      if (categoryText) {
        categories.push({
          name: categoryText,
          count: 0
        });
      }
    });
  }

  return categories.slice(0, 5);
}

function extractJijiTrustIndicatorsFromMarkdown(markdown) {
  return {
    hasProfilePicture: !!extractJijiProfilePictureFromMarkdown(markdown),
    hasLocation: extractJijiLocationFromMarkdown(markdown) !== 'Not specified',
    hasBio: extractJijiBioFromMarkdown(markdown).length > 0,
    accountAge: extractJijiAccountAgeFromMarkdown(markdown),
    totalReviews: extractJijiReviewsFromMarkdown(markdown),
    avgRating: extractJijiRatingFromMarkdown(markdown),
    verificationStatus: extractJijiVerificationFromMarkdown(markdown),
    followers: extractJijiFollowersFromMarkdown(markdown),
    lastSeen: extractJijiLastSeenFromMarkdown(markdown)
  };
}

