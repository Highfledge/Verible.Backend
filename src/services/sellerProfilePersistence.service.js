import Seller from '../models/Seller.model.js';

const MAX_ATTEMPTS = 3;

export function buildVeribleFeedback(seller) {
  if (!seller) {
    return null;
  }

  return {
    endorsements: seller.endorsements || [],
    flags: seller.flags || []
  };
}

export async function saveExtractedSeller({
  existingSeller = null,
  profileUrl,
  extractedData,
  scoringResult
}) {
  if (!profileUrl) {
    throw new Error('profileUrl is required to persist seller data');
  }

  if (!extractedData || !scoringResult) {
    throw new Error('extractedData and scoringResult are required to persist seller data');
  }

  if (existingSeller) {
    return updateSellerWithExtraction(existingSeller, extractedData, scoringResult);
  }

  return createSellerWithRetries({ profileUrl, extractedData, scoringResult });
}

async function updateSellerWithExtraction(seller, extractedData, scoringResult) {
  applyExtractionResults(seller, extractedData, scoringResult);
  await seller.save();
  return seller;
}

async function createSellerWithRetries({ profileUrl, extractedData, scoringResult }) {
  let attempts = 0;
  let seller = null;

  while (attempts < MAX_ATTEMPTS) {
    attempts += 1;

    try {
      seller = await createNewSeller({
        profileUrl,
        extractedData,
        scoringResult,
        sellerId: generateSequentialSellerId(attempts)
      });
      return seller;
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }

      const sellerByUrl = await Seller.findOne({ profileUrl });
      if (sellerByUrl) {
        return updateSellerWithExtraction(sellerByUrl, extractedData, scoringResult);
      }

      if (attempts < MAX_ATTEMPTS) {
        continue;
      }
    }
  }

  const fallbackSeller = await findSimilarSeller({ profileUrl, extractedData });
  if (fallbackSeller) {
    return updateSellerWithExtraction(fallbackSeller, extractedData, scoringResult);
  }

  return createNewSeller({
    profileUrl,
    extractedData,
    scoringResult,
    sellerId: generateRandomSellerId()
  });
}

async function createNewSeller({ profileUrl, extractedData, scoringResult, sellerId }) {
  const seller = new Seller({
    userId: null,
    sellerId,
    platform: extractedData.platform,
    profileUrl,
    isActive: true,
    isClaimed: false
  });

  applyExtractionResults(seller, extractedData, scoringResult);
  await seller.save();
  return seller;
}

async function findSimilarSeller({ profileUrl, extractedData }) {
  if (!extractedData?.profileData?.name) {
    return null;
  }

  return Seller.findOne({
    $or: [
      { profileUrl },
      { 'profileData.name': extractedData.profileData.name },
      { platform: extractedData.platform, sellerId: { $regex: 'extracted-' } }
    ]
  });
}

function applyExtractionResults(seller, extractedData, scoringResult) {
  seller.profileData = extractedData.profileData;
  seller.marketplaceData = extractedData.marketplaceData;
  seller.recentListings = extractedData.recentListings;
  seller.trustIndicators = extractedData.trustIndicators;
  seller.pulseScore = scoringResult.pulseScore;
  seller.confidenceLevel = scoringResult.confidenceLevel;
  seller.lastScored = new Date();
  seller.scoringFactors = scoringResult.categories;
}

function generateSequentialSellerId(attempt) {
  return `extracted-${Date.now()}-${attempt}`;
}

function generateRandomSellerId() {
  return `extracted-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function isDuplicateKeyError(error) {
  return error?.code === 11000;
}

