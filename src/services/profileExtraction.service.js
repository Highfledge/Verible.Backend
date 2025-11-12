import { scrapeWithFirecrawl } from './profileExtraction/firecrawlClient.js';
import { extractFacebookProfile } from './profileExtraction/platforms/facebookExtractor.js';
import { extractJijiProfile } from './profileExtraction/platforms/jijiExtractor.js';
import { extractJumiaProfile } from './profileExtraction/platforms/jumiaExtractor.js';
import { extractKongaProfile } from './profileExtraction/platforms/kongaExtractor.js';
import { extractEtsyProfile } from './profileExtraction/platforms/etsyExtractor.js';
import { extractKijijiProfile } from './profileExtraction/platforms/kijijiExtractor.js';
import { extractEbayProfile } from './profileExtraction/platforms/ebayExtractor.js';

const platformExtractors = {
  facebook: extractFacebookProfile,
  jiji: extractJijiProfile,
  jumia: extractJumiaProfile,
  konga: extractKongaProfile,
  etsy: extractEtsyProfile,
  kijiji: extractKijijiProfile,
  ebay: extractEbayProfile
};

class ProfileExtractionService {
  async extractProfile(url) {
    try {
      const platform = detectPlatform(url);
      const extractor = platformExtractors[platform];

      if (!extractor) {
        throw new Error(`Unsupported platform for URL: ${url}`);
      }

      const scrapedData = await scrapeWithFirecrawl(url);
      return await extractor(scrapedData, url);
    } catch (error) {
      console.error('Profile extraction error:', error);
      throw new Error(`Failed to extract profile: ${error.message}`);
    }
  }
}

function detectPlatform(url) {
  if (!url) {
    return null;
  }

  if (url.includes('facebook.com') || url.includes('fb.com')) {
    return 'facebook';
  }

  if (url.includes('jiji.ng') || url.includes('jiji.com')) {
    return 'jiji';
  }

  if (url.includes('jumia.com')) {
    return 'jumia';
  }

  if (url.includes('konga.com')) {
    return 'konga';
  }

  if (url.includes('etsy.com')) {
    return 'etsy';
  }

  if (url.includes('kijiji.ca') || url.includes('kijiji.com')) {
    return 'kijiji';
  }

  if (url.includes('ebay.')) {
    return 'ebay';
  }

  return null;
}

export default new ProfileExtractionService();

