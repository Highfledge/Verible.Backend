import { parseNumber, parseRating } from '../utils/parser.js';

export async function extractJumiaProfile(scrapedData, url) {
  try {
    const { markdown, metadata } = scrapedData;

    const profilePicture = extractJumiaProfilePictureFromMarkdown(markdown);
    const location = extractJumiaLocationFromMarkdown(markdown);
    const bio = extractJumiaBioFromMarkdown(markdown);
    const accountAge = extractJumiaAccountAgeFromMarkdown(markdown);
    const totalListings = extractJumiaTotalListingsFromMarkdown(markdown);
    const avgRating = extractJumiaRatingFromMarkdown(markdown);
    const totalReviews = extractJumiaReviewsFromMarkdown(markdown);
    const responseRate = extractJumiaResponseRateFromMarkdown(markdown);
    const verificationStatus = extractJumiaVerificationFromMarkdown(markdown);
    const followers = extractJumiaFollowersFromMarkdown(markdown);
    const sellerScore = extractJumiaSellerScoreFromMarkdown(markdown);
    const successfulSales = extractJumiaSuccessfulSalesFromMarkdown(markdown);
    const shippingSpeed = extractJumiaShippingSpeedFromMarkdown(markdown);
    const qualityScore = extractJumiaQualityScoreFromMarkdown(markdown);
    const customerRatingLabel = extractJumiaCustomerRatingLabelFromMarkdown(markdown);
    const officialStore = extractJumiaOfficialStoreStatusFromMarkdown(markdown);
    const categories = extractJumiaCategoriesFromMarkdown(markdown);
    const customerReviews = extractJumiaCustomerReviewsFromMarkdown(markdown);
    const recentListings = extractJumiaRecentListingsFromMarkdown(markdown);

    const dataAvailability = determineJumiaDataAvailability({
      profilePicture,
      location,
      bio,
      recentListings
    });

    const trustIndicators = {
      hasProfilePicture: profilePicture
        ? true
        : dataAvailability.profilePicture === 'platform_unavailable'
          ? null
          : false,
      hasLocation: location && location !== 'Not specified'
        ? true
        : dataAvailability.location === 'platform_unavailable'
          ? null
          : false,
      hasBio: bio
        ? true
        : dataAvailability.bio === 'platform_unavailable'
          ? null
          : false,
      accountAge,
      totalReviews,
      avgRating,
      verificationStatus,
      followers,
      lastSeen: null
    };

    return {
      platform: 'jumia',
      profileUrl: url,
      profileData: {
        name: extractJumiaNameFromMarkdown(markdown, metadata),
        profilePicture,
        location,
        bio
      },
      marketplaceData: {
        accountAge,
        totalListings,
        avgRating,
        totalReviews,
        responseRate,
        verificationStatus,
        followers,
        sellerScore,
        successfulSales,
        shippingSpeed,
        qualityScore,
        customerRatingLabel,
        officialStore,
        categories,
        customerReviews
      },
      recentListings,
      trustIndicators,
      dataAvailability
    };
  } catch (error) {
    console.error('Jumia extraction error:', error);
    throw new Error(`Failed to extract Jumia profile: ${error.message}`);
  }
}

function extractJumiaNameFromMarkdown(markdown, metadata = {}) {
  const sellerProfileMatch = markdown.match(/#\s*Seller Profile[\s\S]*?##\s*([^\n#]+)/i);
  if (sellerProfileMatch && sellerProfileMatch[1]) {
    return sellerProfileMatch[1].trim();
  }

  const headingMatch = markdown.match(
    /^##\s*([^\n#]+)\s*\n(?:\d+\s*%?\s*Seller\s*Score|\d+\s*Followers)/mi
  );
  if (headingMatch && headingMatch[1]) {
    return headingMatch[1].trim();
  }

  const topHeadingMatch = markdown.match(/^#\s*(?!Seller Profile)([^\n#]+)$/mi);
  if (topHeadingMatch && topHeadingMatch[1]) {
    const candidate = topHeadingMatch[1].trim();
    if (candidate && candidate.length <= 100) {
      return candidate;
    }
  }

  if (metadata?.title) {
    const cleanedTitle = metadata.title.split('|')[0].trim();
    if (cleanedTitle) {
      return cleanedTitle;
    }
  }

  return 'Unknown';
}

function extractJumiaProfilePictureFromMarkdown(markdown) {
  const sellerSectionIndex = markdown.indexOf('# Seller Profile');
  const searchScope =
    sellerSectionIndex !== -1
      ? markdown.substring(sellerSectionIndex, sellerSectionIndex + 2000)
      : markdown;

  const imageMatch = searchScope.match(/!\[.*?\]\((https?:\/\/[^)]+\.(?:jpg|jpeg|png|gif|webp))\)/i);
  if (imageMatch && imageMatch[1]) {
    return imageMatch[1];
  }

  const fallbackMatch = markdown.match(
    /!\[.*?\]\((https?:\/\/[^)]+jumia[^)]+\.(?:jpg|jpeg|png|gif|webp))\)/i
  );
  return fallbackMatch ? fallbackMatch[1] : null;
}

function extractJumiaLocationFromMarkdown(markdown) {
  const locationMatch =
    markdown.match(/Location[:\s]+([^\n#]+)/i) ||
    markdown.match(/Ships from[:\s]+([^\n#]+)/i) ||
    markdown.match(/Based in[:\s]+([^\n#]+)/i);

  return locationMatch && locationMatch[1] ? locationMatch[1].trim() : 'Not specified';
}

function extractJumiaBioFromMarkdown(markdown) {
  const aboutMatch = markdown.match(/About(?:\s+Seller)?\s*\n([\s\S]*?)(?=\n##|\n#|$)/i);
  if (aboutMatch && aboutMatch[1]) {
    const cleaned = aboutMatch[1].replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim();
    if (cleaned) {
      return cleaned.substring(0, 500);
    }
  }

  return '';
}

function extractJumiaAccountAgeFromMarkdown(markdown) {
  const yearsMatch = markdown.match(/Selling on Jumia:\s*(\d+)\+?\s*years?/i);
  if (yearsMatch && yearsMatch[1]) {
    return parseInt(yearsMatch[1], 10) * 12;
  }

  const monthsMatch = markdown.match(/Selling on Jumia:\s*(\d+)\s*months?/i);
  if (monthsMatch && monthsMatch[1]) {
    return parseInt(monthsMatch[1], 10);
  }

  const sinceYearMatch = markdown.match(/Seller since\s*(\d{4})/i);
  if (sinceYearMatch && sinceYearMatch[1]) {
    const years = new Date().getFullYear() - parseInt(sinceYearMatch[1], 10);
    return years > 0 ? years * 12 : 0;
  }

  return 0;
}

function extractJumiaTotalListingsFromMarkdown(markdown) {
  const listingMatch = markdown.match(/(\d[\d,]*)\s*(?:products?|items?|results?|listings?)/i);
  if (listingMatch && listingMatch[1]) {
    return parseInt(listingMatch[1].replace(/,/g, ''), 10);
  }

  const inventoryMatch = markdown.match(/has\s+(\d[\d,]*)\s+(?:products?|items?)/i);
  if (inventoryMatch && inventoryMatch[1]) {
    return parseInt(inventoryMatch[1].replace(/,/g, ''), 10);
  }

  return 0;
}

function extractJumiaRatingFromMarkdown(markdown) {
  const ratingMatch = markdown.match(/(\d+\.?\d*)\s*(?:out of|\/)\s*5/i);
  if (ratingMatch && ratingMatch[1]) {
    return parseRating(ratingMatch[1]);
  }

  const sellerScore = extractJumiaSellerScoreFromMarkdown(markdown);
  if (sellerScore) {
    return Math.round((sellerScore / 20) * 10) / 10;
  }

  return 0;
}

function extractJumiaReviewsFromMarkdown(markdown) {
  const reviewsMatch =
    markdown.match(/Customer Reviews\s*\((\d+)\)/i) ||
    markdown.match(/(\d+)\s*customer reviews/i) ||
    markdown.match(/(\d+)\s*reviews/i);

  return reviewsMatch && reviewsMatch[1] ? parseNumber(reviewsMatch[1]) : 0;
}

function extractJumiaResponseRateFromMarkdown(markdown) {
  const sellerScore = extractJumiaSellerScoreFromMarkdown(markdown);
  if (sellerScore) {
    return sellerScore;
  }

  const shippingSpeed = extractJumiaShippingSpeedFromMarkdown(markdown);
  const mappedShipping = mapDescriptorToScore(shippingSpeed);
  if (mappedShipping !== null) {
    return mappedShipping;
  }

  const qualityScore = extractJumiaQualityScoreFromMarkdown(markdown);
  const mappedQuality = mapDescriptorToScore(qualityScore);
  if (mappedQuality !== null) {
    return mappedQuality;
  }

  return 0;
}

function extractJumiaVerificationFromMarkdown(markdown) {
  const lowerMarkdown = markdown.toLowerCase();

  if (
    lowerMarkdown.includes('official store') ||
    lowerMarkdown.includes('jumia mall') ||
    lowerMarkdown.includes('official shop')
  ) {
    return 'verified';
  }

  if (lowerMarkdown.includes('verified seller') || lowerMarkdown.includes('seller verified')) {
    return 'verified';
  }

  return 'unverified';
}

function extractJumiaFollowersFromMarkdown(markdown) {
  const followersMatch = markdown.match(/(\d[\d,]*)\s*followers/i);
  return followersMatch && followersMatch[1] ? parseNumber(followersMatch[1]) : 0;
}

function extractJumiaSellerScoreFromMarkdown(markdown) {
  const scoreMatch = markdown.match(/(\d+)\s*%?\s*Seller\s*Score/i);
  if (scoreMatch && scoreMatch[1]) {
    return parseNumber(scoreMatch[1]);
  }

  const sellerScoreAlt = markdown.match(/Seller Score[:\s]+(\d+)%/i);
  if (sellerScoreAlt && sellerScoreAlt[1]) {
    return parseNumber(sellerScoreAlt[1]);
  }

  return 0;
}

function extractJumiaSuccessfulSalesFromMarkdown(markdown) {
  const salesMatch = markdown.match(/Successful Sales:\s*([\d,]+)\+?/i);
  return salesMatch && salesMatch[1] ? parseNumber(salesMatch[1]) : 0;
}

function extractJumiaShippingSpeedFromMarkdown(markdown) {
  const shippingMatch = markdown.match(/Shipping speed:\s*([^\n#]+)/i);
  return shippingMatch && shippingMatch[1] ? shippingMatch[1].trim() : '';
}

function extractJumiaQualityScoreFromMarkdown(markdown) {
  const qualityMatch = markdown.match(/Quality Score:\s*([^\n#]+)/i);
  return qualityMatch && qualityMatch[1] ? qualityMatch[1].trim() : '';
}

function extractJumiaCustomerRatingLabelFromMarkdown(markdown) {
  const ratingMatch = markdown.match(/Customer Rating:\s*([^\n#]+)/i);
  return ratingMatch && ratingMatch[1] ? ratingMatch[1].trim() : '';
}

function extractJumiaOfficialStoreStatusFromMarkdown(markdown) {
  const lowerMarkdown = markdown.toLowerCase();
  return (
    lowerMarkdown.includes('official store') ||
    lowerMarkdown.includes('official shop') ||
    lowerMarkdown.includes('jumia mall')
  );
}

function extractJumiaCategoriesFromMarkdown(markdown) {
  const categories = [];
  const categoryMatches = markdown.match(/Category[:\s]+([^\n#]+)/gi);

  if (categoryMatches) {
    categoryMatches.forEach(match => {
      const categoryText = match.replace(/Category[:\s]+/i, '').trim();
      if (categoryText && !categories.some(cat => cat.name === categoryText)) {
        categories.push({
          name: categoryText,
          count: 0
        });
      }
    });
  }

  return categories.slice(0, 5);
}

function extractJumiaRecentListingsFromMarkdown(markdown) {
  const listings = [];
  const lines = markdown.split('\n');
  const seenTitles = new Set();

  for (let i = 0; i < lines.length && listings.length < 5; i += 1) {
    const line = lines[i] ? lines[i].trim() : '';
    if (!line || !line.includes('₦')) {
      continue;
    }

    const priceMatch = line.match(/₦\s*([\d,]+)/);
    if (!priceMatch || !priceMatch[1]) {
      continue;
    }

    let title = null;
    let url = null;
    for (let j = i - 1; j >= 0 && i - j <= 6; j -= 1) {
      const prevLine = lines[j] ? lines[j].trim() : '';
      if (prevLine.startsWith('[**')) {
        const titleMatch = prevLine.match(/\[\*\*([^\]]+)\*\*\]\((https?:\/\/[^\)]+)\)/);
        if (titleMatch && titleMatch[1]) {
          title = titleMatch[1].trim();
          url = titleMatch[2] ? titleMatch[2].trim() : null;
          break;
        }
      }
    }

    if (!title || seenTitles.has(title)) {
      continue;
    }

    let isWithinReviews = false;
    for (let k = Math.max(0, i - 5); k <= i; k += 1) {
      const reviewLine = lines[k] ? lines[k].toLowerCase() : '';
      if (reviewLine && reviewLine.includes('customer reviews')) {
        isWithinReviews = true;
        break;
      }
    }
    if (isWithinReviews) {
      continue;
    }

    const ratingLine = lines[i + 1] ? lines[i + 1].trim() : '';
    const ratingMatch = ratingLine.match(/(\d+\.?\d*)\s*out of\s*5/i);
    const rating = ratingMatch && ratingMatch[1] ? parseFloat(ratingMatch[1]) : null;

    let description = '';
    for (let k = i + 1; k <= i + 3 && k < lines.length; k += 1) {
      const nextLine = lines[k] ? lines[k].trim() : '';
      if (!nextLine || nextLine.startsWith('[') || nextLine.startsWith('₦')) {
        continue;
      }
      if (
        nextLine.startsWith('###') ||
        /out of\s*5/i.test(nextLine) ||
        /Verified Purchase/i.test(nextLine)
      ) {
        continue;
      }
      if (nextLine.startsWith('#')) {
        break;
      }
      description = nextLine;
      break;
    }

    listings.push({
      title,
      price: priceMatch[1].replace(/,/g, ''),
      imageCount: 1,
      description,
      hasPrice: true,
      descriptionLength: description.length,
      rating,
      url
    });

    seenTitles.add(title);
  }

  return listings;
}

function extractJumiaCustomerReviewsFromMarkdown(markdown) {
  const reviews = [];
  const lines = markdown.split('\n');
  let inReviewsSection = false;

  for (let i = 0; i < lines.length && reviews.length < 5; i += 1) {
    const line = lines[i] ? lines[i].trim() : '';
    if (!line) {
      continue;
    }

    if (!inReviewsSection) {
      if (line.toLowerCase().startsWith('## customer reviews')) {
        inReviewsSection = true;
      }
      continue;
    }

    if (line.startsWith('#')) {
      break;
    }

    if (line.startsWith('[**')) {
      const productMatch = line.match(/\[\*\*([^\]]+)\*\*\]\((https?:\/\/[^\)]+)\)/);
      if (!productMatch) {
        continue;
      }

      const review = {
        productName: productMatch[1].trim(),
        productUrl: productMatch[2] ? productMatch[2].trim() : null,
        rating: null,
        title: '',
        review: '',
        reviewer: '',
        date: '',
        verifiedPurchase: false
      };

      let cursor = i;

      const ratingLine = lines[cursor + 1] ? lines[cursor + 1].trim() : '';
      const ratingMatch = ratingLine.match(/(\d+\.?\d*)\s*out of\s*5/i);
      if (ratingMatch && ratingMatch[1]) {
        review.rating = parseFloat(ratingMatch[1]);
        cursor += 1;
      }

      const headlineLine = lines[cursor + 1] ? lines[cursor + 1].trim() : '';
      if (headlineLine.startsWith('###')) {
        review.title = headlineLine.replace(/^###\s*/, '').trim();
        cursor += 1;
      }

      const bodyLine = lines[cursor + 1] ? lines[cursor + 1].trim() : '';
      if (bodyLine && !bodyLine.startsWith('[') && !bodyLine.startsWith('#')) {
        review.review = bodyLine;
        cursor += 1;
      }

      const metaLine = lines[cursor + 1] ? lines[cursor + 1].trim() : '';
      const metaMatch = metaLine.match(/(\d{1,2}-\d{1,2}-\d{4})\s*by\s*(.+)/i);
      if (metaMatch) {
        review.date = metaMatch[1];
        review.reviewer = metaMatch[2] ? metaMatch[2].trim() : '';
        cursor += 1;
      }

      const vpLine = lines[cursor + 1] ? lines[cursor + 1].trim() : '';
      if (/verified purchase/i.test(vpLine)) {
        review.verifiedPurchase = true;
        cursor += 1;
      }

      reviews.push(review);
      i = cursor;
    }
  }

  return reviews;
}

function mapDescriptorToScore(descriptor) {
  if (!descriptor) {
    return null;
  }

  const normalized = descriptor.toLowerCase();
  const mapping = [
    { keyword: 'excellent', score: 95 },
    { keyword: 'very good', score: 90 },
    { keyword: 'great', score: 90 },
    { keyword: 'good', score: 80 },
    { keyword: 'average', score: 60 },
    { keyword: 'fair', score: 50 },
    { keyword: 'poor', score: 30 },
    { keyword: 'bad', score: 20 }
  ];

  for (const entry of mapping) {
    if (normalized.includes(entry.keyword)) {
      return entry.score;
    }
  }

  return null;
}

function determineJumiaDataAvailability({ profilePicture, location, bio, recentListings }) {
  const availabilityStatus = status => (status ? 'available' : 'platform_unavailable');

  return {
    profilePicture: availabilityStatus(!!profilePicture),
    location: availabilityStatus(location && location !== 'Not specified'),
    bio: availabilityStatus(!!bio),
    recentListings: availabilityStatus(Array.isArray(recentListings) && recentListings.length > 0)
  };
}

