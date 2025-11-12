import { parseNumber, parseRating } from '../utils/parser.js';

export function extractEtsyProfile(scrapedData, url) {
  const { markdown = '', metadata = {} } = scrapedData;
  const normalizedMarkdown = normalizeMarkdown(markdown);

  const name = extractEtsyName(normalizedMarkdown, metadata);
  const profilePicture = extractEtsyProfilePicture(normalizedMarkdown);
  const location = extractEtsyLocation(normalizedMarkdown);
  const bio = extractEtsyBio(normalizedMarkdown);
  const latestActivity = extractEtsyLatestActivity(normalizedMarkdown);
  const accountAge = extractEtsyAccountAge(normalizedMarkdown, latestActivity);
  const totalSales = extractEtsySales(normalizedMarkdown);
  const { avgRating, totalReviews } = extractEtsyRatingSummary(normalizedMarkdown);
  const admirers = extractEtsyAdmirers(normalizedMarkdown);
  const categories = extractEtsyCategories(normalizedMarkdown);
  const totalListings = extractEtsyTotalListings(categories);
  const recentListings = extractEtsyRecentListings(normalizedMarkdown);
  const customerReviews = extractEtsyCustomerReviews(normalizedMarkdown);
  const shopPolicies = extractEtsyShopPolicies(normalizedMarkdown);
  const supportContacts = extractEtsySupportContacts(normalizedMarkdown, url);

  const dataAvailability = determineEtsyDataAvailability({
    profilePicture,
    location,
    bio,
    recentListings
  });

  const verificationStatus = inferEtsyVerificationStatus(avgRating, totalReviews);
  const lastSeenDays = calculateDaysSinceActivity(latestActivity);

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
    followers: admirers,
    lastSeen: lastSeenDays !== null ? lastSeenDays.toString() : null
  };

  return {
    platform: 'etsy',
    profileUrl: url,
    profileData: {
      name,
      profilePicture,
      location,
      bio
    },
    marketplaceData: {
      accountAge,
      totalListings,
      avgRating,
      totalReviews,
      responseRate: 0,
      verificationStatus,
      lastSeen: lastSeenDays !== null ? lastSeenDays.toString() : null,
      followers: admirers,
      sellerScore: avgRating ? Math.round((avgRating / 5) * 100) : 0,
      successfulSales: totalSales,
      categories,
      customerReviews,
      shopPolicies
    },
    recentListings,
    trustIndicators,
    dataAvailability
  };
}

function normalizeMarkdown(markdown) {
  return markdown.replace(/\r/g, '').replace(/\\\s*/g, '\n');
}

function extractEtsyName(markdown, metadata = {}) {
  const match = markdown.match(/^#\s*([^\n#]+)/m);
  if (match && match[1]) {
    return match[1].trim();
  }

  if (metadata.title) {
    const cleaned = metadata.title.split('|')[0].split('-')[0].trim();
    if (cleaned) {
      return cleaned;
    }
  }

  return 'Unknown';
}

function extractEtsyProfilePicture(markdown) {
  const match = markdown.match(/!\[[^\]]*\]\((https?:\/\/i\.etsystatic\.com\/[^\)]+)\)/i);
  return match ? match[1] : null;
}

function extractEtsyLocation(markdown) {
  const match = markdown.match(/#\s*[^\n]+\n([A-Za-z\s,]+)\n\s*\nLatest activity:/i);
  if (match && match[1]) {
    const location = match[1].trim();
    if (location && !/Latest activity/i.test(location)) {
      return location;
    }
  }
  return 'Not specified';
}

function extractEtsyBio(markdown) {
  const aboutSectionMatch = markdown.match(/##\s*About[^\n]*\n([\s\S]*?)(?=\n##|\n#|$)/i);
  if (aboutSectionMatch && aboutSectionMatch[1]) {
    const cleaned = aboutSectionMatch[1].replace(/\n+/g, ' ').trim();
    if (cleaned) {
      return cleaned.substring(0, 400);
    }
  }
  return '';
}

function extractEtsyLatestActivity(markdown) {
  const match = markdown.match(/Latest activity:\s*([^\n]+)/i);
  return match && match[1] ? match[1].trim() : null;
}

function extractEtsyAccountAge(markdown, latestActivity) {
  const yearsMatch = markdown.match(/(\d+(?:\.\d+)?)\s+years?\s+on\s+Etsy/i);
  if (yearsMatch && yearsMatch[1]) {
    const years = parseFloat(yearsMatch[1]);
    if (!Number.isNaN(years) && years > 0) {
      return Math.round(years * 12);
    }
  }

  const sinceMatch = markdown.match(/On Etsy since\s*(\d{4})/i);
  if (sinceMatch && sinceMatch[1]) {
    const sinceYear = parseInt(sinceMatch[1], 10);
    if (!Number.isNaN(sinceYear)) {
      const referenceDate = latestActivity ? parseEtsyDate(latestActivity) || new Date() : new Date();
      const years = referenceDate.getFullYear() - sinceYear;
      if (years > 0) {
        return years * 12;
      }
    }
  }

  return 0;
}

function extractEtsySales(markdown) {
  const salesMatch = markdown.match(/Sales\s*\n\s*([\d.,kK]+)/i);
  if (salesMatch && salesMatch[1]) {
    return parseCompactNumber(salesMatch[1]);
  }

  const altSalesMatch = markdown.match(/([\d.,kK]+)\s*Sales/i);
  if (altSalesMatch && altSalesMatch[1]) {
    return parseCompactNumber(altSalesMatch[1]);
  }

  return 0;
}

function extractEtsyRatingSummary(markdown) {
  const ratingMatch = markdown.match(/Average item review\s*\n\s*(\d+(?:\.\d+)?)\s*out of\s*5\s*stars?\s*\n\s*\(([\d.,kK]+)\)/i);
  if (ratingMatch) {
    return {
      avgRating: parseRating(ratingMatch[1]),
      totalReviews: parseCompactNumber(ratingMatch[2])
    };
  }

  const summaryMatch = markdown.match(/(\d+(?:\.\d+)?)\s*\[\(([\d.,kK]+)\)\]/);
  if (summaryMatch) {
    return {
      avgRating: parseRating(summaryMatch[1]),
      totalReviews: parseCompactNumber(summaryMatch[2])
    };
  }

  return { avgRating: 0, totalReviews: 0 };
}

function extractEtsyAdmirers(markdown) {
  const match = markdown.match(/\[([\d.,kK]+)\s+Admirers\]/i);
  if (match && match[1]) {
    return parseCompactNumber(match[1]);
  }
  return 0;
}

function extractEtsyCategories(markdown) {
  const categoriesSectionMatch = markdown.match(/Clear search([\s\S]*?)(?=\n\n|\n##|\n#)/i);
  if (!categoriesSectionMatch) {
    return [];
  }

  const lines = categoriesSectionMatch[1].split('\n').map(line => line.trim()).filter(Boolean);
  const categories = [];

  lines.forEach(line => {
    if (!line.startsWith('-')) {
      return;
    }

    const categoryMatch = line.match(/-\s*([^\d]+)\s*(\d+)?/);
    if (categoryMatch) {
      const name = categoryMatch[1].trim();
      const count = categoryMatch[2] ? parseInt(categoryMatch[2], 10) : 0;
      if (name && !categories.some(cat => cat.name === name)) {
        categories.push({
          name,
          count
        });
      }
    }
  });

  return categories;
}

function extractEtsyTotalListings(categories) {
  const allCategory = categories.find(cat => /^All/i.test(cat.name));
  if (allCategory && allCategory.count) {
    return allCategory.count;
  }
  return 0;
}

function extractEtsyRecentListings(markdown) {
  const lines = markdown.split('\n');
  const listings = [];
  const seenTitles = new Set();

  for (let i = 0; i < lines.length && listings.length < 5; i += 1) {
    const line = lines[i] ? lines[i].trim() : '';
    if (!line) {
      continue;
    }

    const listingMatch = line.match(/\*\*([^\*]+)\*\*\]\((https?:\/\/[^\)]+)\)/);
    if (!listingMatch) {
      continue;
    }

    const title = listingMatch[1].trim();
    if (!title || seenTitles.has(title)) {
      continue;
    }

    const urlMatch = line.match(/\((https?:\/\/[^\)]+)\)$/);
    const url = urlMatch ? urlMatch[1].trim() : null;

    let price = '';
    let hasPrice = false;
    let cartsCount = null;

    for (let j = i; j <= i + 6 && j < lines.length; j += 1) {
      const lookaheadLine = lines[j] ? lines[j].trim() : '';
      if (!lookaheadLine) {
        continue;
      }

      if (!hasPrice) {
        const priceMatch = lookaheadLine.match(/^\$([\d.,]+)/);
        if (priceMatch && priceMatch[1]) {
          price = priceMatch[1].replace(/,/g, '');
          hasPrice = true;
        }
      }

      if (cartsCount === null) {
        const cartsMatch = lookaheadLine.match(/(\d+)\s+people?\s+have\s+this\s+in\s+their\s+cart/i);
        if (cartsMatch && cartsMatch[1]) {
          cartsCount = parseInt(cartsMatch[1], 10);
        }
      }
    }

    listings.push({
      title,
      price,
      imageCount: 1,
      description: '',
      hasPrice,
      descriptionLength: 0,
      rating: null,
      url,
      cartsCount
    });

    seenTitles.add(title);
  }

  return listings;
}

function extractEtsyCustomerReviews(markdown) {
  const reviewsSectionMatch = markdown.match(/##\s*Reviews([\s\S]*?)(?=\n##|\n#|$)/i);
  if (!reviewsSectionMatch) {
    return [];
  }

  const section = reviewsSectionMatch[1];
  const reviewBlocks = section.split(/\n- !\[/).slice(1);
  const reviews = [];

  reviewBlocks.forEach(block => {
    if (reviews.length >= 5) {
      return;
    }

    const normalizedBlock = `- ![${block}`;
    const reviewerMatch = normalizedBlock.match(/\]\([^\)]+\)\s*\n\s*\[([^\]]+)\]\([^\)]+\)\s*on\s*([^\n]+)/i);
    const ratingMatch = normalizedBlock.match(/(\d+)\s*out of\s*5\s*stars/i);
    const commentMatch = normalizedBlock.match(/\n([^\n]+)\n\s*\n/);
    const productMatch = normalizedBlock.match(/\[!\[[^\]]*\]\([^\)]+\)\s*\n([^\[]+)\n\[/i);
    const productUrlMatch = normalizedBlock.match(/\n\[[^\]]+\]\((https?:\/\/[^\)]+)\)/i);

    reviews.push({
      reviewer: reviewerMatch && reviewerMatch[1] ? reviewerMatch[1].trim() : '',
      date: reviewerMatch && reviewerMatch[2] ? reviewerMatch[2].trim() : '',
      rating: ratingMatch && ratingMatch[1] ? parseInt(ratingMatch[1], 10) : null,
      review: commentMatch && commentMatch[1] ? commentMatch[1].trim() : '',
      productName: productMatch && productMatch[1] ? productMatch[1].trim() : '',
      productUrl: productUrlMatch ? productUrlMatch[1] : null,
      verifiedPurchase: true
    });
  });

  return reviews;
}

function extractEtsyShopPolicies(markdown) {
  const policiesSectionMatch = markdown.match(/####\s*Shop policies([\s\S]*?)(?=\n###|\n##|\n#|$)/i);
  if (!policiesSectionMatch) {
    return {};
  }

  const section = policiesSectionMatch[1];
  const paymentMatch = section.match(/Accepted payment methods\s*\n([^#]+)/i);
  const payments = paymentMatch
    ? paymentMatch[1]
        .replace(/\n+/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim()
        .split(/(?=[A-Z][a-z]+)/)
        .map(method => method.trim())
        .filter(Boolean)
    : [];

  return {
    acceptedPayments: payments,
    returnsPolicy: /Returns & exchanges/i.test(section) ? 'See item details' : ''
  };
}

function extractEtsySupportContacts(markdown, url) {
  const contactMatch = markdown.match(/\[Contact shop owner\]\((https?:\/\/[^\)]+)\)/i);
  const ownerMatch = markdown.match(/Contact shop owner\s*\n([^\n]+)/i);

  return {
    contactUrl: contactMatch ? contactMatch[1] : null,
    contactName: ownerMatch ? ownerMatch[1].trim() : null,
    platformMessaging: contactMatch ? true : false,
    profileUrl: url
  };
}

function determineEtsyDataAvailability({ profilePicture, location, bio, recentListings }) {
  const availabilityStatus = status => (status ? 'available' : 'platform_unavailable');

  return {
    profilePicture: availabilityStatus(!!profilePicture),
    location: availabilityStatus(location && location !== 'Not specified'),
    bio: availabilityStatus(!!bio),
    recentListings: availabilityStatus(Array.isArray(recentListings) && recentListings.length > 0)
  };
}

function inferEtsyVerificationStatus(avgRating, totalReviews) {
  if (avgRating >= 4.5 && totalReviews >= 50) {
    return 'verified';
  }
  return 'unverified';
}

function calculateDaysSinceActivity(latestActivity) {
  if (!latestActivity) {
    return null;
  }

  const parsedDate = parseEtsyDate(latestActivity);
  if (!parsedDate) {
    return null;
  }

  const diffMs = Date.now() - parsedDate.getTime();
  if (Number.isNaN(diffMs) || diffMs < 0) {
    return null;
  }

  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function parseEtsyDate(dateText) {
  const parsed = new Date(dateText);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseCompactNumber(value) {
  if (!value) {
    return 0;
  }

  const cleaned = value.toString().replace(/,/g, '').trim().toLowerCase();

  if (/^\d+(\.\d+)?k$/.test(cleaned)) {
    return Math.round(parseFloat(cleaned.replace('k', '')) * 1000);
  }

  if (/^\d+(\.\d+)?m$/.test(cleaned)) {
    return Math.round(parseFloat(cleaned.replace('m', '')) * 1000000);
  }

  const numeric = parseFloat(cleaned);
  return Number.isNaN(numeric) ? 0 : Math.round(numeric);
}


