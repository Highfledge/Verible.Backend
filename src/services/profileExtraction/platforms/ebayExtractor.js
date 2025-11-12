import { parseNumber } from '../utils/parser.js';

export function extractEbayProfile(scrapedData, url) {
  const { markdown = '' } = scrapedData;
  const normalizedMarkdown = normalizeMarkdown(markdown);

  const name = extractEbayName(normalizedMarkdown);
  const profilePicture = extractEbayProfilePicture(normalizedMarkdown);
  const bio = extractEbayBio(normalizedMarkdown);
  const positiveFeedback = extractEbayPositiveFeedback(normalizedMarkdown);
  const itemsSold = extractEbayItemsSold(normalizedMarkdown);
  const followers = extractEbayFollowers(normalizedMarkdown);
  const categories = extractEbayCategories(normalizedMarkdown);
  const recentListings = extractEbayRecentListings(normalizedMarkdown);
  const avgRating = positiveFeedback ? Number((positiveFeedback / 20).toFixed(2)) : 0;
  const verificationStatus = extractEbayVerificationStatus(normalizedMarkdown, itemsSold);

  return {
    platform: 'ebay',
    profileUrl: url,
    profileData: {
      name,
      profilePicture,
      location: 'Not specified',
      bio
    },
    marketplaceData: {
      accountAge: 0,
      totalListings: recentListings.length,
      avgRating,
      totalReviews: 0,
      responseRate: 0,
      verificationStatus,
      lastSeen: null,
      followers,
      successfulSales: itemsSold,
      categories
    },
    recentListings,
    trustIndicators: {
      hasProfilePicture: !!profilePicture,
      hasLocation: false,
      hasBio: bio.length > 0,
      accountAge: 0,
      totalReviews: 0,
      avgRating,
      verificationStatus,
      followers
    },
    sellerMetrics: {
      positiveFeedbackPercent: positiveFeedback,
      itemsSold,
      followers
    }
  };
}

function normalizeMarkdown(markdown) {
  return markdown.replace(/\r/g, '').replace(/\\\s*/g, '\n');
}

function extractEbayName(markdown) {
  const match =
    markdown.match(/#\s*\[([^\]]+)\]/) ||
    markdown.match(/##\s*([^\n#]+)/) ||
    markdown.match(/adidas canada/i);

  if (match && match[1]) {
    return match[1].trim();
  }

  if (match && typeof match[0] === 'string') {
    return match[0].trim();
  }

  return 'Unknown';
}

function extractEbayProfilePicture(markdown) {
  const match = markdown.match(/!\[[^\]]*\]\((https?:\/\/i\.ebayimg\.com\/[^\)]+)\)/i);
  return match ? match[1] : null;
}

function extractEbayBio(markdown) {
  const match = markdown.match(/Official eBay Store of [^\n]+/i);
  return match ? match[0].trim() : '';
}

function extractEbayPositiveFeedback(markdown) {
  const match = markdown.match(/([\d.]+)%\s*positive feedback/i);
  return match ? parseFloat(match[1]) : 0;
}

function extractEbayItemsSold(markdown) {
  const match = markdown.match(/([\d.,kKmM]+)\s+items\s+sold/i);
  return match ? parseCompactNumber(match[1]) : 0;
}

function extractEbayFollowers(markdown) {
  const match = markdown.match(/([\d.,kKmM]+)\s+followers/i);
  return match ? parseCompactNumber(match[1]) : 0;
}

function extractEbayCategories(markdown) {
  const categoryMatches = markdown.match(/-\s*\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g);
  if (!categoryMatches) {
    return [];
  }

  const categories = [];
  const seen = new Set();

  categoryMatches.forEach(item => {
    const nameMatch = item.match(/-\s*\[([^\]]+)\]/);
    if (!nameMatch || !nameMatch[1]) {
      return;
    }

    const rawName = nameMatch[1].trim();
    const normalizedName = rawName.replace(/\s{2,}/g, ' ');

    if (!normalizedName || seen.has(normalizedName.toLowerCase())) {
      return;
    }

    seen.add(normalizedName.toLowerCase());
    categories.push({
      name: normalizedName,
      count: 0
    });
  });

  return categories.slice(0, 10);
}

function extractEbayRecentListings(markdown) {
  const listings = [];
  const pattern =
    /\[!\[[^\]]*\]\((https?:\/\/[^\)]+)\)\]\((https?:\/\/[^\)]+)\)\s*\n\s*\*\*([^\*]+)\*\*\]\((https?:\/\/[^\)]+)\)\s*\n([^\n]+)/g;

  let match;

  while ((match = pattern.exec(markdown)) !== null && listings.length < 8) {
    const imageUrl = match[1];
    const productUrl = match[4] || match[2];
    const title = match[3] ? match[3].trim() : '';
    const priceLine = match[5] ? match[5].trim() : '';

    if (!title) {
      continue;
    }

    const priceMatches = Array.from(priceLine.matchAll(/\$([\d.,]+)/g));
    const salePrice = priceMatches[0] ? priceMatches[0][1].replace(/,/g, '') : '';
    const originalPrice = priceMatches[1] ? priceMatches[1][1].replace(/,/g, '') : '';
    const hasPrice = salePrice !== '';

    listings.push({
      title,
      price: salePrice,
      originalPrice: originalPrice || null,
      priceDisplay: priceLine || null,
      currency: /C\s*\$/i.test(priceLine) ? 'CAD' : priceLine.includes('$') ? 'USD' : null,
      imageCount: imageUrl ? 1 : 0,
      imageUrl: imageUrl || null,
      description: '',
      hasPrice,
      descriptionLength: 0,
      url: productUrl || null
    });
  }

  return listings;
}

function extractEbayVerificationStatus(markdown, itemsSold) {
  if (/Official eBay Store/i.test(markdown)) {
    return 'verified';
  }

  if (itemsSold > 1000) {
    return 'trusted';
  }

  return 'unverified';
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
  if (!Number.isNaN(numeric)) {
    return Math.round(numeric);
  }

  return parseNumber(value);
}




