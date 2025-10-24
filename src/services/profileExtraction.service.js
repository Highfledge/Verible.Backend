import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Profile Extraction Service
 * Extracts seller data from Facebook Marketplace and Jiji profiles
 */
class ProfileExtractionService {
  constructor() {
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
  }

  /**
   * Extract seller profile data from URL
   * @param {string} url - The profile URL
   * @returns {Object} Extracted seller data
   */
  async extractProfile(url) {
    try {
      const platform = this.detectPlatform(url);
      
      if (platform === 'facebook') {
        return await this.extractFacebookProfile(url);
      } else if (platform === 'jiji') {
        return await this.extractJijiProfile(url);
      } else {
        throw new Error('Unsupported platform');
      }
    } catch (error) {
      console.error('Profile extraction error:', error);
      throw new Error(`Failed to extract profile: ${error.message}`);
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
   * Extract Facebook Marketplace seller data
   * @param {string} url 
   * @returns {Object} Facebook seller data
   */
  async extractFacebookProfile(url) {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
        },
        timeout: 10000
      });

      const $ = cheerio.load(response.data);
      
      // Extract seller information
      const sellerData = {
        platform: 'facebook',
        profileUrl: url,
        profileData: {
          name: this.extractFacebookName($),
          profilePicture: this.extractFacebookProfilePicture($),
          location: this.extractFacebookLocation($),
          bio: this.extractFacebookBio($)
        },
        marketplaceData: {
          accountAge: this.extractFacebookAccountAge($),
          totalListings: this.extractFacebookTotalListings($),
          avgRating: this.extractFacebookRating($),
          totalReviews: this.extractFacebookReviews($),
          responseRate: this.extractFacebookResponseRate($),
          verificationStatus: this.extractFacebookVerification($)
        },
        recentListings: this.extractFacebookRecentListings($),
        trustIndicators: this.extractFacebookTrustIndicators($)
      };

      return sellerData;
    } catch (error) {
      console.error('Facebook extraction error:', error);
      throw new Error(`Failed to extract Facebook profile: ${error.message}`);
    }
  }

  /**
   * Extract Jiji seller data
   * @param {string} url 
   * @returns {Object} Jiji seller data
   */
  async extractJijiProfile(url) {
    try {
      console.log('🔍 Starting Jiji extraction for:', url);
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
        },
        timeout: 10000
      });

      console.log('📡 Jiji response status:', response.status);
      console.log('📄 Jiji response length:', response.data.length);
      console.log('🔍 Jiji response preview:', response.data.substring(0, 500));
      
      // Debug: Check what classes and elements are available
      const $ = cheerio.load(response.data);
      console.log('🔍 Available classes with "user", "profile", "seller", "shop":');
      $('[class*="user"], [class*="profile"], [class*="seller"], [class*="shop"]').each((i, el) => {
        console.log(`  - Element ${i}:`, $(el).attr('class'), '| Text:', $(el).text().trim().substring(0, 50));
      });
      
      // Debug extraction
      const name = this.extractJijiName($);
      const profilePicture = this.extractJijiProfilePicture($);
      const location = this.extractJijiLocation($);
      const bio = this.extractJijiBio($);
      
      console.log('👤 Extracted name:', name);
      console.log('🖼️ Extracted profile picture:', profilePicture);
      console.log('📍 Extracted location:', location);
      console.log('📝 Extracted bio:', bio);
      
      const sellerData = {
        platform: 'jiji',
        profileUrl: url,
        profileData: {
          name,
          profilePicture,
          location,
          bio
        },
        marketplaceData: {
          accountAge: this.extractJijiAccountAge($),
          totalListings: this.extractJijiTotalListings($),
          avgRating: this.extractJijiRating($),
          totalReviews: this.extractJijiReviews($),
          responseRate: this.extractJijiResponseRate($),
          verificationStatus: this.extractJijiVerification($),
          lastSeen: this.extractJijiLastSeen($),
          followers: this.extractJijiFollowers($),
          categories: this.extractJijiCategories($)
        },
        recentListings: this.extractJijiRecentListings($),
        trustIndicators: this.extractJijiTrustIndicators($)
      };
      
      console.log('✅ Jiji extraction completed:', JSON.stringify(sellerData, null, 2));

      return sellerData;
    } catch (error) {
      console.error('Jiji extraction error:', error);
      throw new Error(`Failed to extract Jiji profile: ${error.message}`);
    }
  }

  // Facebook extraction methods
  extractFacebookName($) {
    return $('h1[data-testid="profile_name_in_profile_page"]').text().trim() ||
           $('.x1heor9g').first().text().trim() ||
           $('h1').first().text().trim() ||
           'Unknown';
  }

  extractFacebookProfilePicture($) {
    return $('img[data-testid="profile_picture"]').attr('src') ||
           $('.x1heor9g img').first().attr('src') ||
           null;
  }

  extractFacebookLocation($) {
    return $('[data-testid="profile_location"]').text().trim() ||
           $('.x1heor9g').eq(1).text().trim() ||
           'Not specified';
  }

  extractFacebookBio($) {
    return $('[data-testid="profile_bio"]').text().trim() ||
           $('.x1heor9g').eq(2).text().trim() ||
           '';
  }

  extractFacebookAccountAge($) {
    const ageText = $('[data-testid="account_age"]').text() ||
                    $('.x1heor9g').filter((i, el) => 
                      $(el).text().includes('year') || $(el).text().includes('month')
                    ).first().text();
    
    return this.parseAccountAge(ageText);
  }

  extractFacebookTotalListings($) {
    const listingsText = $('[data-testid="total_listings"]').text() ||
                        $('.x1heor9g').filter((i, el) => 
                          $(el).text().includes('listing')
                        ).first().text();
    
    return this.parseNumber(listingsText);
  }

  extractFacebookRating($) {
    const ratingText = $('[data-testid="avg_rating"]').text() ||
                       $('.x1heor9g').filter((i, el) => 
                         $(el).text().includes('rating')
                       ).first().text();
    
    return this.parseRating(ratingText);
  }

  extractFacebookReviews($) {
    const reviewsText = $('[data-testid="total_reviews"]').text() ||
                        $('.x1heor9g').filter((i, el) => 
                          $(el).text().includes('review')
                        ).first().text();
    
    return this.parseNumber(reviewsText);
  }

  extractFacebookResponseRate($) {
    const responseText = $('[data-testid="response_rate"]').text() ||
                         $('.x1heor9g').filter((i, el) => 
                           $(el).text().includes('response')
                         ).first().text();
    
    return this.parsePercentage(responseText);
  }

  extractFacebookVerification($) {
    return $('[data-testid="verification_status"]').text().trim() ||
           $('.x1heor9g').filter((i, el) => 
             $(el).text().includes('verified')
           ).first().text().trim() ||
           'unverified';
  }

  extractFacebookRecentListings($) {
    const listings = [];
    $('[data-testid="recent_listing"]').each((i, el) => {
      const title = $(el).find('[data-testid="listing_title"]').text().trim();
      const price = $(el).find('[data-testid="listing_price"]').text().trim();
      const date = $(el).find('[data-testid="listing_date"]').text().trim();
      
      if (title) {
        listings.push({ title, price, date });
      }
    });
    
    return listings.slice(0, 5); // Return last 5 listings
  }

  extractFacebookTrustIndicators($) {
    return {
      hasProfilePicture: !!this.extractFacebookProfilePicture($),
      hasLocation: this.extractFacebookLocation($) !== 'Not specified',
      hasBio: this.extractFacebookBio($).length > 0,
      accountAge: this.extractFacebookAccountAge($),
      totalReviews: this.extractFacebookReviews($),
      avgRating: this.extractFacebookRating($),
      verificationStatus: this.extractFacebookVerification($)
    };
  }

  // Jiji extraction methods
  extractJijiName($) {
    // Try multiple selectors for Jiji
    const title = $('title').text().trim();
    const userName = $('.user-name').text().trim();
    const h1Name = $('h1').first().text().trim();
    const shopName = $('.shop-name').text().trim();
    const sellerName = $('.seller-name').text().trim();
    const profileName = $('.profile-name').text().trim();
    
    console.log('🔍 Looking for Jiji name...');
    console.log('  - title found:', title);
    console.log('  - .user-name found:', userName);
    console.log('  - h1 found:', h1Name);
    console.log('  - .shop-name found:', shopName);
    console.log('  - .seller-name found:', sellerName);
    console.log('  - .profile-name found:', profileName);
    
    // Extract name from title if it contains seller info
    let extractedName = 'Unknown';
    if (title && title.includes('|')) {
      extractedName = title.split('|')[0].trim();
    }
    
    return extractedName || userName || h1Name || shopName || sellerName || profileName || 'Unknown';
  }

  extractJijiProfilePicture($) {
    // Try multiple selectors for Jiji profile picture
    const avatarImg = $('.user-avatar img').attr('src');
    const profileImg = $('.profile-picture img').attr('src');
    const sellerPhoto = $('.b-seller-info-block__photo img').attr('src');
    const sellerPhotoWrapper = $('.b-seller-info-block__photo-wrapper img').attr('src');
    
    console.log('🖼️ Looking for Jiji profile picture...');
    console.log('  - .user-avatar img found:', avatarImg);
    console.log('  - .profile-picture img found:', profileImg);
    console.log('  - .b-seller-info-block__photo img found:', sellerPhoto);
    console.log('  - .b-seller-info-block__photo-wrapper img found:', sellerPhotoWrapper);
    
    return avatarImg || profileImg || sellerPhoto || sellerPhotoWrapper || null;
  }

  extractJijiLocation($) {
    const userLocation = $('.user-location').text().trim();
    const location = $('.location').text().trim();
    const sellerLocation = $('.b-seller-info-block__location').text().trim();
    const sellerDetails = $('.b-seller-info-block__details').text().trim();
    
    console.log('📍 Looking for Jiji location...');
    console.log('  - .user-location found:', userLocation);
    console.log('  - .location found:', location);
    console.log('  - .b-seller-info-block__location found:', sellerLocation);
    console.log('  - .b-seller-info-block__details found:', sellerDetails);
    
    return userLocation || location || sellerLocation || 'Not specified';
  }

  extractJijiBio($) {
    const userBio = $('.user-bio').text().trim();
    const bio = $('.bio').text().trim();
    const sellerBio = $('.b-seller-tile-info-block__text').text().trim();
    const aboutSeller = $('.b-seller-sidebar-info-block__wrapper').text().trim();
    
    console.log('📝 Looking for Jiji bio...');
    console.log('  - .user-bio found:', userBio);
    console.log('  - .bio found:', bio);
    console.log('  - .b-seller-tile-info-block__text found:', sellerBio);
    console.log('  - .b-seller-sidebar-info-block__wrapper found:', aboutSeller);
    
    return userBio || bio || sellerBio || aboutSeller || '';
  }

  extractJijiAccountAge($) {
    const ageText = $('.account-age').text() ||
                    $('.member-since').text() ||
                    $('.b-advert-seller__label').text() ||
                    $('.b-seller-info-tiles__item').text() ||
                    $('.b-seller-info-block__details').text();
    
    console.log('📅 Looking for Jiji account age...');
    console.log('  - .account-age found:', $('.account-age').text());
    console.log('  - .member-since found:', $('.member-since').text());
    console.log('  - .b-advert-seller__label found:', $('.b-advert-seller__label').text());
    console.log('  - .b-seller-info-tiles__item found:', $('.b-seller-info-tiles__item').text());
    console.log('  - .b-seller-info-block__details found:', $('.b-seller-info-block__details').text());
    
    // Look for "5+ years" or "5y 2m" patterns
    const allText = $('body').text();
    const yearMatch = allText.match(/(\d+)\+?\s*years?/i);
    const monthMatch = allText.match(/(\d+)\s*y\s*(\d+)\s*m/i);
    
    console.log('🔍 Year pattern match:', yearMatch);
    console.log('🔍 Month pattern match:', monthMatch);
    
    if (yearMatch) {
      return parseInt(yearMatch[1]) * 12; // Convert years to months
    }
    if (monthMatch) {
      return parseInt(monthMatch[1]) * 12 + parseInt(monthMatch[2]); // Years + months
    }
    
    return this.parseAccountAge(ageText);
  }

  extractJijiTotalListings($) {
    const listingsText = $('.total-listings').text() ||
                        $('.ads-count').text() ||
                        $('.b-seller-top-categories__item-count').first().text() ||
                        $('.b-seller-top-categories-list__item-count').first().text();
    
    console.log('📊 Looking for Jiji total listings...');
    console.log('  - .total-listings found:', $('.total-listings').text());
    console.log('  - .ads-count found:', $('.ads-count').text());
    console.log('  - .b-seller-top-categories__item-count found:', $('.b-seller-top-categories__item-count').first().text());
    console.log('  - .b-seller-top-categories-list__item-count found:', $('.b-seller-top-categories-list__item-count').first().text());
    
    return this.parseNumber(listingsText);
  }

  extractJijiRating($) {
    const ratingText = $('.user-rating').text() ||
                       $('.rating').text();
    
    return this.parseRating(ratingText);
  }

  extractJijiReviews($) {
    const reviewsText = $('.total-reviews').text() ||
                       $('.reviews-count').text() ||
                       $('.b-leave-feedback-button').text() ||
                       $('.b-seller-page__sidebar-buttons-item').text();
    
    console.log('📊 Looking for Jiji reviews...');
    console.log('  - .total-reviews found:', $('.total-reviews').text());
    console.log('  - .reviews-count found:', $('.reviews-count').text());
    console.log('  - .b-leave-feedback-button found:', $('.b-leave-feedback-button').text());
    console.log('  - .b-seller-page__sidebar-buttons-item found:', $('.b-seller-page__sidebar-buttons-item').text());
    
    // Look for "View feedback (227)" pattern
    const allText = $('body').text();
    const feedbackMatch = allText.match(/feedback\s*\((\d+)\)/i);
    const reviewMatch = allText.match(/reviews?\s*\((\d+)\)/i);
    
    console.log('🔍 Feedback pattern match:', feedbackMatch);
    console.log('🔍 Review pattern match:', reviewMatch);
    
    if (feedbackMatch) {
      return parseInt(feedbackMatch[1]);
    }
    if (reviewMatch) {
      return parseInt(reviewMatch[1]);
    }
    
    return this.parseNumber(reviewsText);
  }

  extractJijiResponseRate($) {
    const responseText = $('.response-rate').text();
    return this.parsePercentage(responseText);
  }

  extractJijiVerification($) {
    const verificationBadge = $('.verification-badge').text().trim();
    const verified = $('.verified').text().trim();
    const sellerLabels = $('.b-advert-seller__label').text().trim();
    const allText = $('body').text();
    
    console.log('🔍 Looking for Jiji verification...');
    console.log('  - .verification-badge found:', verificationBadge);
    console.log('  - .verified found:', verified);
    console.log('  - .b-advert-seller__label found:', sellerLabels);
    
    // Look for "Verified ID" or "Verified" in the text
    if (allText.includes('Verified ID') || allText.includes('Verified')) {
      console.log('✅ Found verification status: verified');
      return 'id-verified';
    }
    
    return verificationBadge || verified || 'unverified';
  }

  extractJijiRecentListings($) {
    const listings = [];
    
    console.log('📋 Looking for Jiji recent listings...');
    
    // Try multiple selectors for listings
    $('.b-seller-page__listing-items .b-advert-item, .b-advert-item, .b-listing-item').each((i, el) => {
      const title = $(el).find('.b-advert-item__title, .b-listing-item__title, .b-advert-item__name').text().trim();
      const price = $(el).find('.b-advert-item__price, .b-listing-item__price, .b-advert-item__price-value').text().trim();
      const date = $(el).find('.b-advert-item__date, .b-listing-item__date, .b-advert-item__time').text().trim();
      const category = $(el).find('.b-advert-item__category, .b-listing-item__category').text().trim();
      
      if (title && title.length > 5) {
        listings.push({ 
          title, 
          price: this.extractPrice(price), 
          date, 
          category,
          description: $(el).find('.b-advert-item__description, .b-listing-item__description').text().trim()
        });
      }
    });
    
    console.log(`📋 Found ${listings.length} listings:`, listings.slice(0, 3));
    
    return listings.slice(0, 10); // Return last 10 listings for better analysis
  }

  extractJijiLastSeen($) {
    const lastSeenText = $('.b-seller-info-tiles__item').first().text().trim() ||
                         $('.b-seller-info-block__details').text().trim();
    
    console.log('🕐 Looking for Jiji last seen...');
    console.log('  - .b-seller-info-tiles__item found:', $('.b-seller-info-tiles__item').first().text());
    console.log('  - .b-seller-info-block__details found:', $('.b-seller-info-block__details').text());
    
    // Look for "Last seen X hours ago" pattern
    const allText = $('body').text();
    const lastSeenMatch = allText.match(/last seen (\d+)\s*(hours?|days?|minutes?)/i);
    
    console.log('🔍 Last seen pattern match:', lastSeenMatch);
    
    return lastSeenText || 'Unknown';
  }

  extractJijiFollowers($) {
    const followersText = $('.b-seller-following-button__count').text().trim() ||
                         $('.b-seller-info-block__follow').text().trim();
    
    console.log('👥 Looking for Jiji followers...');
    console.log('  - .b-seller-following-button__count found:', $('.b-seller-following-button__count').text());
    console.log('  - .b-seller-info-block__follow found:', $('.b-seller-info-block__follow').text());
    
    return this.parseNumber(followersText);
  }

  extractJijiCategories($) {
    const categories = [];
    
    console.log('📂 Looking for Jiji categories...');
    
    $('.b-seller-top-categories-list__item').each((i, el) => {
      const category = $(el).find('.b-seller-top-categories-list__item-category').text().trim();
      const count = $(el).find('.b-seller-top-categories-list__item-count').text().trim();
      
      if (category && count) {
        categories.push({
          name: category,
          count: this.parseNumber(count)
        });
      }
    });
    
    console.log(`📂 Found ${categories.length} categories:`, categories.slice(0, 5));
    
    return categories;
  }

  extractJijiTrustIndicators($) {
    return {
      hasProfilePicture: !!this.extractJijiProfilePicture($),
      hasLocation: this.extractJijiLocation($) !== 'Not specified',
      hasBio: this.extractJijiBio($).length > 0,
      accountAge: this.extractJijiAccountAge($),
      totalReviews: this.extractJijiReviews($),
      avgRating: this.extractJijiRating($),
      verificationStatus: this.extractJijiVerification($),
      followers: this.extractJijiFollowers($),
      lastSeen: this.extractJijiLastSeen($)
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
