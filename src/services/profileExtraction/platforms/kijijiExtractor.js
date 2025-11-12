import { parseNumber } from '../utils/parser.js';

export function extractKijijiProfile(scrapedData, url) {
  const { markdown = '' } = scrapedData;
  const normalizedMarkdown = normalizeMarkdown(markdown);

  const name = extractKijijiName(normalizedMarkdown);
  const profilePicture = extractKijijiProfilePicture(normalizedMarkdown);
  const location = extractKijijiLocation(normalizedMarkdown);
  const bio = extractKijijiBio(normalizedMarkdown);
  const accountAge = extractKijijiAccountAge(normalizedMarkdown);
  const overallRating = extractKijijiRating(normalizedMarkdown);
  const totalReviews = extractKijijiReviewCount(normalizedMarkdown);
  const replyMetrics = extractKijijiReplyMetrics(normalizedMarkdown);
  const listingCount = extractKijijiListingCount(normalizedMarkdown);
  const recentListings = extractKijijiRecentListings(normalizedMarkdown);
  const customerReviews = extractKijijiCustomerReviews(normalizedMarkdown);

  const dataAvailability = determineKijijiDataAvailability({
    profilePicture,
    location,
    bio,
    replyMetrics,
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
    avgRating: overallRating,
    verificationStatus: totalReviews > 0 && overallRating >= 4.5 ? 'verified' : 'unverified',
    followers: null,
    lastSeen: null,
    replyRate: replyMetrics.replyRate,
    replyTime: replyMetrics.replyTime
  };

  return {
    platform: 'kijiji',
    profileUrl: url,
    profileData: {
      name,
      profilePicture,
      location,
      bio
    },
    marketplaceData: {
      accountAge,
      totalListings: listingCount,
      avgRating: overallRating,
      totalReviews,
      responseRate: replyMetrics.replyRateNumber,
      verificationStatus: trustIndicators.verificationStatus,
      lastSeen: null,
      followers: null,
      sellerScore: overallRating ? Math.round((overallRating / 5) * 100) : 0,
      successfulSales: 0,
      categories: [],
      customerReviews,
      replyMetrics
    },
    recentListings,
    trustIndicators,
    dataAvailability
  };
}

function normalizeMarkdown(markdown) {
  return markdown.replace(/\r/g, '').replace(/\\\s*/g, '\n');
}

function extractKijijiName(markdown) {
  const match = markdown.match(/^#\s*([^\n#]+)/m);
  return match && match[1] ? match[1].trim() : 'Unknown';
}

function extractKijijiProfilePicture(markdown) {
  const match = markdown.match(/!\[[^\]]*\]\((https?:\/\/media\.kijiji\.ca\/[^\)]+)\)/i);
  return match ? match[1] : null;
}

function extractKijijiLocation(markdown) {
  const match = markdown.match(/([A-Za-z\s]+,\s*[A-Za-z\s]+)\nLatest activity/i);
  if (match && match[1]) {
    return match[1].trim();
  }

  const headerMatch = markdown.match(/([A-Za-z\s]+,\s*[A-Za-z\s]+)Search/i);
  if (headerMatch && headerMatch[1]) {
    return headerMatch[1].trim();
  }

  return 'Not specified';
}

function extractKijijiBio() {
  return '';
}

function extractKijijiAccountAge(markdown) {
  const match = markdown.match(/(\d+)\s*yrs\s*\n\s*on\s+Kijiji/i);
  if (match && match[1]) {
    const years = parseInt(match[1], 10);
    if (!Number.isNaN(years) && years > 0) {
      return years * 12;
    }
  }
  return 0;
}

function extractKijijiRating(markdown) {
  const match = markdown.match(/#\s*[^\n]+\n\s*([\d.]+)\s*\n\s*\[/i);
  if (match && match[1]) {
    const rating = parseFloat(match[1]);
    return Number.isNaN(rating) ? 0 : rating;
  }
  return 0;
}

function extractKijijiReviewCount(markdown) {
  const match = markdown.match(/\(([\d,]+)\s+reviews?\)/i);
  if (match && match[1]) {
    return parseNumber(match[1]);
  }

  const singleReviewMatch = markdown.match(/\((1 review)\)/i);
  if (singleReviewMatch) {
    return 1;
  }

  return 0;
}

function extractKijijiReplyMetrics(markdown) {
  const replyTimeMatch = markdown.match(/avg reply\s*\n\s*([^\n]+)/i);
  const replyRateMatch = markdown.match(/reply rate\s*\n\s*([^\n]+)/i);

  const replyTimeRaw = replyTimeMatch && replyTimeMatch[1] ? replyTimeMatch[1].trim() : null;
  const replyRateRaw = replyRateMatch && replyRateMatch[1] ? replyRateMatch[1].trim() : null;

  const replyRateNumber = replyRateRaw && replyRateRaw.includes('%')
    ? parseInt(replyRateRaw.replace('%', ''), 10)
    : replyRateRaw && replyRateRaw !== '--'
      ? 100
      : 0;

  return {
    replyTime: replyTimeRaw && replyTimeRaw !== '--' ? replyTimeRaw : null,
    replyRate: replyRateRaw && replyRateRaw !== '--' ? replyRateRaw : null,
    replyRateNumber: Number.isNaN(replyRateNumber) ? 0 : replyRateNumber
  };
}

function extractKijijiListingCount(markdown) {
  const match = markdown.match(/##\s*([\d,]+)\s+listings/i);
  if (match && match[1]) {
    return parseNumber(match[1]);
  }
  return 0;
}

function extractKijijiRecentListings(markdown) {
  const lines = markdown.split('\n');
  const listings = [];
  const seenTitles = new Set();

  for (let i = 0; i < lines.length && listings.length < 5; i += 1) {
    const line = lines[i] ? lines[i].trim() : '';
    if (!line) {
      continue;
    }

    const titleMatch = line.match(/\[\*\*([^\]]+)\*\*\]\((https?:\/\/[^\)]+)\)/);
    if (!titleMatch) {
      continue;
    }

    const title = titleMatch[1].trim();
    if (!title || seenTitles.has(title)) {
      continue;
    }

    const url = titleMatch[2] ? titleMatch[2].trim() : null;

    let price = '';
    let hasPrice = false;
    let postedAgo = '';
    let location = '';
    let description = '';

    for (let j = i; j <= i + 6 && j < lines.length; j += 1) {
      const lookaheadLine = lines[j] ? lines[j].trim() : '';
      if (!lookaheadLine) {
        continue;
      }

      if (!hasPrice) {
        const priceMatch = lookaheadLine.match(/^\$([\d,]+(?:\.\d{2})?)/);
        if (priceMatch && priceMatch[1]) {
          price = priceMatch[1].replace(/,/g, '');
          hasPrice = true;
        }
      }

      if (!description && lookaheadLine.length > 20 && !lookaheadLine.startsWith('$') && !lookaheadLine.startsWith('![')) {
        description = lookaheadLine.length > 200 ? `${lookaheadLine.substring(0, 200)}...` : lookaheadLine;
      }

      if (!postedAgo) {
        const timeMatch = lookaheadLine.match(/(\d+\s*[dwmy]|\d+\s*(?:hours?|minutes?)|Today)/i);
        if (timeMatch && timeMatch[1]) {
          postedAgo = timeMatch[1];
        }
      }

      if (!location) {
        const locationMatch = lookaheadLine.match(/([A-Za-z\s]+,\s*[A-Za-z\s]+)/);
        if (locationMatch && locationMatch[1]) {
          location = locationMatch[1].trim();
        }
      }
    }

    listings.push({
      title,
      price,
      imageCount: 1,
      description,
      hasPrice,
      descriptionLength: description.length,
      rating: null,
      url,
      postedAgo,
      location
    });

    seenTitles.add(title);
  }

  return listings;
}

function extractKijijiCustomerReviews(markdown) {
  const reviewsSectionMatch = markdown.match(/##\s*Reviews([\s\S]*?)(?=\n##|\n#|$)/i);
  if (!reviewsSectionMatch) {
    return [];
  }

  const section = reviewsSectionMatch[1];
  const reviews = [];
  const reviewMatches = section.split(/\n- \[/).slice(1);

  reviewMatches.forEach(block => {
    if (reviews.length >= 5) {
      return;
    }

    const normalizedBlock = `- [${block}`;
    const reviewerMatch = normalizedBlock.match(/\]\([^\)]+\)\s*\n\s*(\d+)\s*out of\s*5\s*stars\s*\n\s*([^\n]+)/i);
    const commentMatch = normalizedBlock.match(/\n([^\n]+)\n\s*\n/);
    const productMatch = normalizedBlock.match(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/);

    reviews.push({
      reviewer: reviewerMatch && reviewerMatch[2] ? reviewerMatch[2].trim() : '',
      rating: reviewerMatch && reviewerMatch[1] ? parseInt(reviewerMatch[1], 10) : null,
      review: commentMatch && commentMatch[1] ? commentMatch[1].trim() : '',
      productName: productMatch && productMatch[1] ? productMatch[1].trim() : '',
      productUrl: productMatch && productMatch[2] ? productMatch[2].trim() : null,
      date: '',
      verifiedPurchase: false
    });
  });

  return reviews;
}

function determineKijijiDataAvailability({ profilePicture, location, bio, replyMetrics, recentListings }) {
  const availabilityStatus = status => (status ? 'available' : 'platform_unavailable');

  return {
    profilePicture: availabilityStatus(!!profilePicture),
    location: availabilityStatus(location && location !== 'Not specified'),
    bio: availabilityStatus(!!bio),
    replyMetrics: availabilityStatus(replyMetrics.replyRate || replyMetrics.replyTime),
    recentListings: availabilityStatus(Array.isArray(recentListings) && recentListings.length > 0)
  };
}


