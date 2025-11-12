import { parseNumber, parsePercentage, parseRating } from '../utils/parser.js';

export function extractKongaProfile(scrapedData, url) {
  const { markdown = '', metadata = {} } = scrapedData;
  const normalizedMarkdown = normalizeMarkdown(markdown);

  const profilePicture = extractKongaProfilePicture(normalizedMarkdown);
  const location = extractKongaLocation();
  const bio = extractKongaBio(normalizedMarkdown);
  const accountAge = extractKongaAccountAge(normalizedMarkdown);
  const totalListings = extractKongaTotalListings(normalizedMarkdown);
  const { avgRating, totalReviews } = extractKongaRatingAndReviews(normalizedMarkdown);
  const productQuality = extractKongaProductQuality(normalizedMarkdown);
  const deliveryRate = extractKongaDeliveryRate(normalizedMarkdown);
  const successfulSales = extractKongaSuccessfulSales(normalizedMarkdown);
  const categories = extractKongaCategories(normalizedMarkdown);
  const priceRanges = extractKongaPriceRanges(normalizedMarkdown);
  const brands = extractKongaBrands(normalizedMarkdown);
  const itemAvailability = extractKongaItemAvailability(normalizedMarkdown);
  const shippingOptions = extractKongaShippingOptions(normalizedMarkdown);
  const supportContacts = extractKongaSupportContacts(normalizedMarkdown);
  const recentListings = extractKongaRecentListings(normalizedMarkdown);

  const dataAvailability = determineKongaDataAvailability({
    profilePicture,
    location,
    bio,
    recentListings
  });

  const verificationStatus = inferKongaVerificationStatus(normalizedMarkdown);

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
    followers: null,
    lastSeen: null
  };

  return {
    platform: 'konga',
    profileUrl: url,
    profileData: {
      name: extractKongaName(normalizedMarkdown, metadata),
      profilePicture,
      location,
      bio
    },
    marketplaceData: {
      accountAge,
      totalListings,
      avgRating,
      totalReviews,
      responseRate: deliveryRate || 0,
      verificationStatus,
      followers: null,
      sellerScore: productQuality || 0,
      successfulSales,
      deliveryRate,
      productQuality,
      categories,
      priceRanges,
      brands,
      itemAvailability,
      shippingOptions,
      supportContacts
    },
    recentListings,
    trustIndicators,
    dataAvailability
  };
}

function normalizeMarkdown(markdown) {
  return markdown.replace(/\r/g, '').replace(/\\\s*/g, '\n');
}

function extractKongaName(markdown, metadata = {}) {
  const lines = markdown.split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line.startsWith('#')) {
      continue;
    }

    const candidate = line.replace(/^#+\s*/, '').trim();
    if (!candidate) {
      continue;
    }

    if (!/^Skip to main content/i.test(candidate)) {
      return candidate;
    }
  }

  if (metadata.title) {
    const cleaned = metadata.title.split('|')[0].split('-')[0].trim();
    if (cleaned) {
      return cleaned;
    }
  }

  return 'Unknown';
}

function extractKongaProfilePicture(markdown) {
  const storeImageMatch = markdown.match(
    /!\[[^\]]*(?:store|merchant|seller)[^\]]*\]\((https?:\/\/[^\)]+\.(?:jpg|jpeg|png|gif|webp))\)/i
  );
  if (storeImageMatch && storeImageMatch[1]) {
    return storeImageMatch[1];
  }

  const genericImageMatch = markdown.match(
    /!\[[^\]]*\]\((https?:\/\/[^\)]+\.(?:jpg|jpeg|png|gif|webp))\)/i
  );
  return genericImageMatch ? genericImageMatch[1] : null;
}

function extractKongaLocation() {
  // Konga merchant pages do not currently expose a seller-specific location.
  return 'Not specified';
}

function extractKongaBio(markdown) {
  const aboutSectionMatch = markdown.match(/###\s*About\s+Konga([\s\S]*?)(?=\n###|\n#|$)/i);
  if (aboutSectionMatch && aboutSectionMatch[1]) {
    const cleaned = aboutSectionMatch[1].replace(/\n+/g, ' ').trim();
    if (cleaned) {
      return cleaned.substring(0, 400);
    }
  }
  return '';
}

function extractKongaAccountAge(markdown) {
  const yearsMatch = markdown.match(/###\s*([\d,]+)\s*Years?\s*\n\s*Selling on Konga/i);
  if (yearsMatch && yearsMatch[1]) {
    const years = parseInt(yearsMatch[1].replace(/,/g, ''), 10);
    if (!Number.isNaN(years) && years > 0) {
      return years * 12;
    }
  }

  const monthsMatch = markdown.match(/###\s*([\d,]+)\s*Months?\s*\n\s*Selling on Konga/i);
  if (monthsMatch && monthsMatch[1]) {
    const months = parseInt(monthsMatch[1].replace(/,/g, ''), 10);
    if (!Number.isNaN(months)) {
      return months;
    }
  }

  return 0;
}

function extractKongaTotalListings(markdown) {
  const listingsMatch = markdown.match(/of\s+([\d,]+)\s+results/i);
  if (listingsMatch && listingsMatch[1]) {
    return parseNumber(listingsMatch[1]);
  }
  return 0;
}

function extractKongaRatingAndReviews(markdown) {
  const ratingMatch = markdown.match(/###\s*(\d+(?:\.\d+)?)\s*from\s*([\d,]+)\s*reviews/i);
  if (ratingMatch) {
    const avgRating = parseRating(ratingMatch[1]);
    const totalReviews = parseNumber(ratingMatch[2]);
    return { avgRating, totalReviews };
  }
  return { avgRating: 0, totalReviews: 0 };
}

function extractKongaProductQuality(markdown) {
  const qualitySection = markdown.match(/####\s*Product Quality:?\s*\n\s*([\d%]+)/i);
  if (qualitySection && qualitySection[1]) {
    return parsePercentage(qualitySection[1]);
  }
  return 0;
}

function extractKongaDeliveryRate(markdown) {
  const deliverySection = markdown.match(/####\s*Delivery Rate:?\s*\n\s*([\d%]+)/i);
  if (deliverySection && deliverySection[1]) {
    return parsePercentage(deliverySection[1]);
  }
  return 0;
}

function extractKongaSuccessfulSales(markdown) {
  const salesMatch = markdown.match(/###\s*([\d,]+)\s*\n\s*Successful Sales/i);
  if (salesMatch && salesMatch[1]) {
    return parseNumber(salesMatch[1]);
  }
  return 0;
}

function extractKongaSectionItems(markdown, heading) {
  const sectionMatch = markdown.match(
    new RegExp(`###\\s*${heading}[\\s\\S]*?(?=\\n###|\\n#|$)`, 'i')
  );

  if (!sectionMatch) {
    return [];
  }

  const lines = sectionMatch[0].split('\n');
  const items = [];

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('-')) {
      return;
    }

    const linkMatch = trimmed.match(/- \[(.+?)\]\((https?:\/\/[^\)]+)\)/);
    if (linkMatch) {
      items.push({
        name: linkMatch[1].trim(),
        url: linkMatch[2].trim()
      });
      return;
    }

    const plainMatch = trimmed.match(/-+\s*(.+)$/);
    if (plainMatch) {
      items.push({
        name: plainMatch[1].trim(),
        url: null
      });
    }
  });

  return items;
}

function extractKongaCategories(markdown) {
  return extractKongaSectionItems(markdown, 'Browse Categories').map(item => ({
    name: item.name,
    count: 0,
    url: item.url
  }));
}

function extractKongaPriceRanges(markdown) {
  return extractKongaSectionItems(markdown, 'Price').map(item => item.name);
}

function extractKongaBrands(markdown) {
  return extractKongaSectionItems(markdown, 'Brand').map(item => ({
    name: item.name.replace(/\d+$/, '').trim(),
    count: parseNumber(item.name)
  }));
}

function extractKongaItemAvailability(markdown) {
  return extractKongaSectionItems(markdown, 'Item Availability').map(item => item.name);
}

function extractKongaShippingOptions(markdown) {
  return extractKongaSectionItems(markdown, 'Shipping').map(item => item.name);
}

function extractKongaSupportContacts(markdown) {
  const emailMatch = markdown.match(/([a-z0-9._%+-]+@konga\.com)/i);
  const phoneMatches = Array.from(
    new Set(
      (markdown.match(/(?:\+?234|\b0)\d{9,10}\b/g) || []).map(number => number.trim())
    )
  );
  const whatsappSection = markdown.match(/###\s*Whatsapp([\s\S]*?)(?=\n###|\n#|$)/i);
  const whatsappMatches = whatsappSection
    ? Array.from(new Set((whatsappSection[1].match(/(?:\+?234|\b0)\d{9,10}\b/g) || [])))
    : [];

  return {
    email: emailMatch ? emailMatch[1].toLowerCase() : null,
    phoneNumbers: phoneMatches,
    whatsappNumbers: whatsappMatches
  };
}

function extractKongaRecentListings(markdown) {
  const lines = markdown.split('\n');
  const listings = [];
  const seenTitles = new Set();

  for (let i = 0; i < lines.length && listings.length < 5; i += 1) {
    const line = lines[i] ? lines[i].trim() : '';
    if (!line) {
      continue;
    }

    const listingMatch = line.match(/\[\*\*([^\]]+)\*\*\]\((https?:\/\/[^\)]+)\)/);
    if (!listingMatch) {
      continue;
    }

    const title = listingMatch[1].trim();
    if (!title || seenTitles.has(title)) {
      continue;
    }

    const url = listingMatch[2] ? listingMatch[2].trim() : null;

    let price = '';
    let hasPrice = false;
    let reviewsCount = null;

    for (let j = i; j <= i + 6 && j < lines.length; j += 1) {
      const lookaheadLine = lines[j] ? lines[j].trim() : '';
      if (!lookaheadLine) {
        continue;
      }

      if (!hasPrice) {
        const priceMatch = lookaheadLine.match(/\u20a6\s*([\d,]+)/i);
        if (priceMatch && priceMatch[1]) {
          price = priceMatch[1].replace(/,/g, '');
          hasPrice = true;
        }
      }

      if (reviewsCount === null) {
        const reviewMatch = lookaheadLine.match(/(\d+)\s+Review(s)?/i);
        if (reviewMatch && reviewMatch[1]) {
          reviewsCount = parseInt(reviewMatch[1], 10);
        } else if (/No reviews yet/i.test(lookaheadLine)) {
          reviewsCount = 0;
        }
      }

      if (hasPrice && reviewsCount !== null) {
        break;
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
      reviewsCount,
      url
    });

    seenTitles.add(title);
  }

  return listings;
}

function determineKongaDataAvailability({ profilePicture, location, bio, recentListings }) {
  const availabilityStatus = status => (status ? 'available' : 'platform_unavailable');

  return {
    profilePicture: availabilityStatus(!!profilePicture),
    location: availabilityStatus(location && location !== 'Not specified'),
    bio: availabilityStatus(!!bio),
    recentListings: availabilityStatus(Array.isArray(recentListings) && recentListings.length > 0)
  };
}

function inferKongaVerificationStatus(markdown) {
  const lower = markdown.toLowerCase();
  if (lower.includes('verified seller') || lower.includes('official store')) {
    return 'verified';
  }
  return 'unverified';
}


