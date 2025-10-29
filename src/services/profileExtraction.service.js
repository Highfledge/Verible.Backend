// Using Firecrawl API for web scraping

/**
 * Profile Extraction Service
 * Extracts seller data from Facebook Marketplace and Jiji profiles
 */
class ProfileExtractionService {
  constructor() {
    this.firecrawlApiKey = 'process.env.FIRECRAWL_API_KEY';
    this.firecrawlUrl = 'https://api.firecrawl.dev/v2/scrape';
  }

  /**
   * Extract seller profile data from URL using Firecrawl API
   * @param {string} url - The profile URL
   * @returns {Object} Extracted seller data
   */
  async extractProfile(url) {
    try {
      const platform = this.detectPlatform(url);
      
      // Use Firecrawl API to scrape the page
      const scrapedData = await this.scrapeWithFirecrawl(url);
      
      if (platform === 'facebook') {
        return await this.extractFacebookProfile(scrapedData, url);
      } else if (platform === 'jiji') {
        return await this.extractJijiProfile(scrapedData, url);
      } else {
        throw new Error('Unsupported platform');
      }
    } catch (error) {
      console.error('Profile extraction error:', error);
      throw new Error(`Failed to extract profile: ${error.message}`);
    }
  }

  /**
   * Scrape URL using Firecrawl API
   * @param {string} url - The URL to scrape
   * @returns {Object} Scraped data with markdown content
   */
  async scrapeWithFirecrawl(url) {
    try {
      const options = {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.firecrawlApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          "url": url,
          "onlyMainContent": false,
          "maxAge": 172800000,
          "parsers": ["pdf"],
          "formats": ["markdown"]
        })
      };

      const response = await fetch(this.firecrawlUrl, options);
      
      if (!response.ok) {
        throw new Error(`Firecrawl API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.data) {
        return {
          markdown: data.data.markdown || '',
          html: data.data.html || '',
          metadata: data.data.metadata || {}
        };
      } else {
        throw new Error('Firecrawl API returned unsuccessful response');
      }
    } catch (error) {
      console.error('Firecrawl scraping error:', error);
      throw new Error(`Failed to scrape URL with Firecrawl: ${error.message}`);
    }
  }

  /**
   * Detect platform from URL
   * @param {string} url 
   * @returns {string} Platform name
   */
  detectPlatform(url) {
    if (url.includes('facebook.com') || url.includes('fb.com')) {
      return 'facebook';
    } else if (url.includes('jiji.ng') || url.includes('jiji.com')) {
      return 'jiji';
    } else {
      return 'other';
    }
  }

  /**
   * Extract Facebook Marketplace seller data from Firecrawl markdown
   * @param {Object} scrapedData - Scraped data from Firecrawl
   * @param {string} url - Original URL
   * @returns {Object} Facebook seller data
   */
  async extractFacebookProfile(scrapedData, url) {
    try {
      const { markdown, metadata } = scrapedData;
      
      // Extract seller information from markdown content
      const sellerData = {
        platform: 'facebook',
        profileUrl: url,
        profileData: {
          name: this.extractFacebookNameFromMarkdown(markdown),
          profilePicture: this.extractFacebookProfilePictureFromMarkdown(markdown),
          location: this.extractFacebookLocationFromMarkdown(markdown),
          bio: this.extractFacebookBioFromMarkdown(markdown)
        },
        marketplaceData: {
          accountAge: this.extractFacebookAccountAgeFromMarkdown(markdown),
          totalListings: this.extractFacebookTotalListingsFromMarkdown(markdown),
          avgRating: this.extractFacebookRatingFromMarkdown(markdown),
          totalReviews: this.extractFacebookReviewsFromMarkdown(markdown),
          responseRate: this.extractFacebookResponseRateFromMarkdown(markdown),
          verificationStatus: this.extractFacebookVerificationFromMarkdown(markdown)
        },
        recentListings: this.extractFacebookRecentListingsFromMarkdown(markdown),
        trustIndicators: this.extractFacebookTrustIndicatorsFromMarkdown(markdown)
      };

      return sellerData;
    } catch (error) {
      console.error('Facebook extraction error:', error);
      throw new Error(`Failed to extract Facebook profile: ${error.message}`);
    }
  }

  /**
   * Extract Jiji seller data from Firecrawl markdown
   * @param {Object} scrapedData - Scraped data from Firecrawl
   * @param {string} url - Original URL
   * @returns {Object} Jiji seller data
   */
  async extractJijiProfile(scrapedData, url) {
    try {
      console.log('🔍 Starting Jiji extraction for:', url);
      
      const { markdown, metadata } = scrapedData;
      
      console.log('📄 Jiji markdown length:', markdown.length);
      console.log('🔍 Jiji markdown preview:', markdown.substring(0, 500));
      
      // Extract seller information from markdown content
      const sellerData = {
        platform: 'jiji',
        profileUrl: url,
        profileData: {
          name: this.extractJijiNameFromMarkdown(markdown),
          profilePicture: this.extractJijiProfilePictureFromMarkdown(markdown),
          location: this.extractJijiLocationFromMarkdown(markdown),
          bio: this.extractJijiBioFromMarkdown(markdown)
        },
        marketplaceData: {
          accountAge: this.extractJijiAccountAgeFromMarkdown(markdown),
          totalListings: this.extractJijiTotalListingsFromMarkdown(markdown),
          avgRating: this.extractJijiRatingFromMarkdown(markdown),
          totalReviews: this.extractJijiReviewsFromMarkdown(markdown),
          responseRate: this.extractJijiResponseRateFromMarkdown(markdown),
          verificationStatus: this.extractJijiVerificationFromMarkdown(markdown),
          lastSeen: this.extractJijiLastSeenFromMarkdown(markdown),
          followers: this.extractJijiFollowersFromMarkdown(markdown),
          categories: this.extractJijiCategoriesFromMarkdown(markdown)
        },
        recentListings: this.extractJijiRecentListingsFromMarkdown(markdown),
        trustIndicators: this.extractJijiTrustIndicatorsFromMarkdown(markdown)
      };
      
      console.log('✅ Jiji extraction completed:', JSON.stringify(sellerData, null, 2));

      return sellerData;
    } catch (error) {
      console.error('Jiji extraction error:', error);
      throw new Error(`Failed to extract Jiji profile: ${error.message}`);
    }
  }

  // Facebook extraction methods from markdown
  extractFacebookNameFromMarkdown(markdown) {
    // Look for profile name patterns in markdown
    const nameMatch = markdown.match(/#\s*([^#\n]+)/) || 
                     markdown.match(/\*\*([^*]+)\*\*/) ||
                     markdown.match(/^([^#\n]+)$/m);
    
    return nameMatch ? nameMatch[1].trim() : 'Unknown';
  }

  extractFacebookProfilePictureFromMarkdown(markdown) {
    // Look for image URLs in markdown
    const imageMatch = markdown.match(/!\[.*?\]\((https?:\/\/[^)]+\.(jpg|jpeg|png|gif|webp))/i);
    return imageMatch ? imageMatch[1] : null;
  }

  extractFacebookLocationFromMarkdown(markdown) {
    // Look for location patterns
    const locationMatch = markdown.match(/(?:location|lives in|from)[:\s]+([^#\n]+)/i) ||
                         markdown.match(/📍\s*([^#\n]+)/i);
    
    return locationMatch ? locationMatch[1].trim() : 'Not specified';
  }

  extractFacebookBioFromMarkdown(markdown) {
    // Look for bio/about section
    const bioMatch = markdown.match(/(?:about|bio)[:\s]+([^#\n]+)/i) ||
                    markdown.match(/📝\s*([^#\n]+)/i);
    
    return bioMatch ? bioMatch[1].trim() : '';
  }

  extractFacebookAccountAgeFromMarkdown(markdown) {
    // Look for account age patterns
    const ageMatch = markdown.match(/(?:member since|joined|account age)[:\s]+([^#\n]+)/i) ||
                    markdown.match(/(\d+)\s*(?:year|month)/i);
    
    return this.parseAccountAge(ageMatch ? ageMatch[1] : '');
  }

  extractFacebookTotalListingsFromMarkdown(markdown) {
    // Look for listings count
    const listingsMatch = markdown.match(/(?:listings|items|products)[:\s]+(\d+)/i) ||
                         markdown.match(/(\d+)\s*(?:listings|items|products)/i);
    
    return this.parseNumber(listingsMatch ? listingsMatch[1] : '');
  }

  extractFacebookRatingFromMarkdown(markdown) {
    // Look for rating patterns
    const ratingMatch = markdown.match(/(?:rating|stars)[:\s]+(\d+\.?\d*)/i) ||
                       markdown.match(/(\d+\.?\d*)\s*(?:stars?|rating)/i);
    
    return this.parseRating(ratingMatch ? ratingMatch[1] : '');
  }

  extractFacebookReviewsFromMarkdown(markdown) {
    // Look for reviews count
    const reviewsMatch = markdown.match(/(?:reviews|feedback)[:\s]+(\d+)/i) ||
                        markdown.match(/(\d+)\s*(?:reviews?|feedback)/i);
    
    return this.parseNumber(reviewsMatch ? reviewsMatch[1] : '');
  }

  extractFacebookResponseRateFromMarkdown(markdown) {
    // Look for response rate
    const responseMatch = markdown.match(/(?:response rate|response)[:\s]+(\d+)%/i) ||
                         markdown.match(/(\d+)%\s*(?:response rate|response)/i);
    
    return this.parsePercentage(responseMatch ? responseMatch[1] : '');
  }

  extractFacebookVerificationFromMarkdown(markdown) {
    // Look for verification status
    if (markdown.match(/(?:verified|verification)/i)) {
      return 'verified';
    }
    return 'unverified';
  }

  extractFacebookRecentListingsFromMarkdown(markdown) {
    const listings = [];
    // Look for listing patterns in markdown
    const listingMatches = markdown.match(/(?:title|item)[:\s]+([^#\n]+)/gi);
    
    if (listingMatches) {
      listingMatches.slice(0, 5).forEach(match => {
        const title = match.replace(/(?:title|item)[:\s]+/i, '').trim();
      if (title) {
          listings.push({ title, price: '', date: '' });
      }
    });
    }
    
    return listings;
  }

  extractFacebookTrustIndicatorsFromMarkdown(markdown) {
    return {
      hasProfilePicture: !!this.extractFacebookProfilePictureFromMarkdown(markdown),
      hasLocation: this.extractFacebookLocationFromMarkdown(markdown) !== 'Not specified',
      hasBio: this.extractFacebookBioFromMarkdown(markdown).length > 0,
      accountAge: this.extractFacebookAccountAgeFromMarkdown(markdown),
      totalReviews: this.extractFacebookReviewsFromMarkdown(markdown),
      avgRating: this.extractFacebookRatingFromMarkdown(markdown),
      verificationStatus: this.extractFacebookVerificationFromMarkdown(markdown)
    };
  }

  // Jiji extraction methods from markdown
  extractJijiNameFromMarkdown(markdown) {
    // Look for shop/seller name patterns in markdown
    const titleMatch = markdown.match(/#\s*([^#\n]+)/) || 
                      markdown.match(/\*\*([^*]+)\*\*/) ||
                      markdown.match(/^([^#\n]+)$/m);
    
    // Extract name from title if it contains seller info
    let extractedName = 'Unknown';
    if (titleMatch && titleMatch[1].includes('|')) {
      extractedName = titleMatch[1].split('|')[0].trim();
    } else if (titleMatch) {
      extractedName = titleMatch[1].trim();
    }
    
    return extractedName;
  }

  extractJijiProfilePictureFromMarkdown(markdown) {
    // Look for image URLs in markdown
    const imageMatch = markdown.match(/!\[.*?\]\((https?:\/\/[^)]+\.(jpg|jpeg|png|gif|webp))/i);
    return imageMatch ? imageMatch[1] : null;
  }

  extractJijiLocationFromMarkdown(markdown) {
    // Look for location patterns
    const locationMatch = markdown.match(/(?:location|address|lives in|from)[:\s]+([^#\n]+)/i) ||
                         markdown.match(/📍\s*([^#\n]+)/i);
    
    return locationMatch ? locationMatch[1].trim() : 'Not specified';
  }

  extractJijiBioFromMarkdown(markdown) {
    // Look for bio/about section
    const bioMatch = markdown.match(/(?:about|bio|description)[:\s]+([^#\n]+)/i) ||
                    markdown.match(/📝\s*([^#\n]+)/i);
    
    return bioMatch ? bioMatch[1].trim() : '';
  }

  extractJijiAccountAgeFromMarkdown(markdown) {
    // Look for account age patterns
    const ageMatch = markdown.match(/(?:member since|joined|account age)[:\s]+([^#\n]+)/i) ||
                    markdown.match(/(\d+)\+?\s*years?/i) ||
                    markdown.match(/(\d+)\s*y\s*(\d+)\s*m/i);
    
    if (ageMatch && ageMatch[1]) {
      if (ageMatch[1].includes('year')) {
        return parseInt(ageMatch[1]) * 12; // Convert years to months
      }
      if (ageMatch[2] && ageMatch[3]) {
        return parseInt(ageMatch[2]) * 12 + parseInt(ageMatch[3]); // Years + months
      }
    }
    
    return this.parseAccountAge(ageMatch ? ageMatch[1] : '');
  }

  extractJijiTotalListingsFromMarkdown(markdown) {
    // Look for listings count
    const listingsMatch = markdown.match(/(?:listings|ads|items|products)[:\s]+(\d+)/i) ||
                         markdown.match(/(\d+)\s*(?:listings|ads|items|products)/i);
    
    return this.parseNumber(listingsMatch ? listingsMatch[1] : '');
  }

  extractJijiRatingFromMarkdown(markdown) {
    // Look for rating patterns
    const ratingMatch = markdown.match(/(?:rating|stars)[:\s]+(\d+\.?\d*)/i) ||
                       markdown.match(/(\d+\.?\d*)\s*(?:stars?|rating)/i);
    
    return this.parseRating(ratingMatch ? ratingMatch[1] : '');
  }

  extractJijiReviewsFromMarkdown(markdown) {
    // Look for reviews count
    const reviewsMatch = markdown.match(/(?:reviews|feedback)[:\s]+(\d+)/i) ||
                        markdown.match(/(\d+)\s*(?:reviews?|feedback)/i) ||
                        markdown.match(/feedback\s*\((\d+)\)/i);
    
    return this.parseNumber(reviewsMatch ? reviewsMatch[1] : '');
  }

  extractJijiResponseRateFromMarkdown(markdown) {
    // Look for response rate
    const responseMatch = markdown.match(/(?:response rate|response)[:\s]+(\d+)%/i) ||
                         markdown.match(/(\d+)%\s*(?:response rate|response)/i);
    
    return this.parsePercentage(responseMatch ? responseMatch[1] : '');
  }

  extractJijiVerificationFromMarkdown(markdown) {
    // Look for verification status
    if (markdown.match(/(?:verified id|verified)/i)) {
      return 'id-verified';
    }
    if (markdown.match(/(?:verified|verification)/i)) {
      return 'verified';
    }
    return 'unverified';
  }

  extractJijiRecentListingsFromMarkdown(markdown) {
    const listings = [];
    
    // Look for listing patterns in markdown
    const listingMatches = markdown.match(/(?:title|item|product)[:\s]+([^#\n]+)/gi);
    
    if (listingMatches) {
      listingMatches.slice(0, 10).forEach(match => {
        const title = match.replace(/(?:title|item|product)[:\s]+/i, '').trim();
      if (title && title.length > 5) {
        listings.push({ 
          title, 
            price: '', 
            date: '', 
            category: '',
            description: ''
        });
      }
    });
    }
    
    return listings;
  }

  extractJijiLastSeenFromMarkdown(markdown) {
    // Look for last seen patterns
    const lastSeenMatch = markdown.match(/last seen (\d+)\s*(hours?|days?|minutes?)/i) ||
                         markdown.match(/(?:last seen|active)[:\s]+([^#\n]+)/i);
    
    return lastSeenMatch ? lastSeenMatch[1] : 'Unknown';
  }

  extractJijiFollowersFromMarkdown(markdown) {
    // Look for followers count
    const followersMatch = markdown.match(/(?:followers|following)[:\s]+(\d+)/i) ||
                          markdown.match(/(\d+)\s*(?:followers?|following)/i);
    
    return this.parseNumber(followersMatch ? followersMatch[1] : '');
  }

  extractJijiCategoriesFromMarkdown(markdown) {
    const categories = [];
    
    // Look for category patterns
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

  extractJijiTrustIndicatorsFromMarkdown(markdown) {
    return {
      hasProfilePicture: !!this.extractJijiProfilePictureFromMarkdown(markdown),
      hasLocation: this.extractJijiLocationFromMarkdown(markdown) !== 'Not specified',
      hasBio: this.extractJijiBioFromMarkdown(markdown).length > 0,
      accountAge: this.extractJijiAccountAgeFromMarkdown(markdown),
      totalReviews: this.extractJijiReviewsFromMarkdown(markdown),
      avgRating: this.extractJijiRatingFromMarkdown(markdown),
      verificationStatus: this.extractJijiVerificationFromMarkdown(markdown),
      followers: this.extractJijiFollowersFromMarkdown(markdown),
      lastSeen: this.extractJijiLastSeenFromMarkdown(markdown)
    };
  }

  // Utility methods
  parseAccountAge(ageText) {
    if (!ageText) return 0;
    
    const years = ageText.match(/(\d+)\s*year/);
    const months = ageText.match(/(\d+)\s*month/);
    
    if (years) return parseInt(years[1]) * 12;
    if (months) return parseInt(months[1]);
    
    return 0;
  }

  parseNumber(text) {
    if (!text) return 0;
    const match = text.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  parseRating(text) {
    if (!text) return 0;
    const match = text.match(/(\d+\.?\d*)/);
    return match ? parseFloat(match[1]) : 0;
  }

  parsePercentage(text) {
    if (!text) return 0;
    const match = text.match(/(\d+)%/);
    return match ? parseInt(match[1]) : 0;
  }

 



}

export default new ProfileExtractionService();
