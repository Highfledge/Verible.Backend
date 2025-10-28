import axios from 'axios';

/**
 * Proxy Service
 * Handles different proxy providers for web scraping
 * Supports ScraperAPI, Bright Data, Oxylabs, and Zyte
 */
class ProxyService {
  constructor() {
    this.providers = {
      scraperapi: {
        enabled: process.env.SCRAPERAPI_ENABLED === 'true',
        apiKey: process.env.SCRAPERAPI_API_KEY,
        baseUrl: 'http://api.scraperapi.com',
        port: 8001
      },
      brightdata: {
        enabled: process.env.BRIGHT_DATA_ENABLED === 'true',
        username: process.env.BRIGHT_DATA_USERNAME,
        password: process.env.BRIGHT_DATA_PASSWORD,
        endpoint: process.env.BRIGHT_DATA_ENDPOINT
      },
      oxylabs: {
        enabled: process.env.OXYLABS_ENABLED === 'true',
        username: process.env.OXYLABS_USERNAME,
        password: process.env.OXYLABS_PASSWORD,
        endpoint: process.env.OXYLABS_ENDPOINT
      },
      zyte: {
        enabled: process.env.ZYTE_ENABLED === 'true',
        apiKey: process.env.ZYTE_API_KEY,
        baseUrl: 'http://proxy.zyte.com',
        port: 8011
      }
    };
    
    this.proxyEnabled = process.env.PROXY_ENABLED === 'true';
    this.provider = process.env.PROXY_PROVIDER || 'scraperapi';
    this.timeout = parseInt(process.env.PROXY_TIMEOUT) || 30000;
    this.retryAttempts = parseInt(process.env.PROXY_RETRY_ATTEMPTS) || 3;
    
    // Track failed proxies for rotation
    this.failedProxies = new Set();
    this.proxyRotationIndex = 0;
  }

  /**
   * Get proxy configuration for the current provider
   * @returns {Object|null} Proxy configuration or null if disabled
   */
  getProxyConfig() {
    if (!this.proxyEnabled) {
      return null;
    }

    const provider = this.providers[this.provider];
    if (!provider || !provider.enabled) {
      console.warn(`Proxy provider ${this.provider} is not enabled or configured`);
      return null;
    }

    switch (this.provider) {
      case 'scraperapi':
        return this.getScraperApiConfig();
      case 'brightdata':
        return this.getBrightDataConfig();
      case 'oxylabs':
        return this.getOxylabsConfig();
      case 'zyte':
        return this.getZyteConfig();
      default:
        console.warn(`Unknown proxy provider: ${this.provider}`);
        return null;
    }
  }

  /**
   * Get ScraperAPI configuration
   * @returns {Object} ScraperAPI proxy config
   */
  getScraperApiConfig() {
    const provider = this.providers.scraperapi;
    if (!provider.apiKey) {
      throw new Error('ScraperAPI API key is required');
    }

    return {
      host: 'proxy.scraperapi.com',
      port: provider.port,
      auth: {
        username: 'scraperapi',
        password: provider.apiKey
      }
    };
  }

  /**
   * Get Bright Data configuration
   * @returns {Object} Bright Data proxy config
   */
  getBrightDataConfig() {
    const provider = this.providers.brightdata;
    if (!provider.username || !provider.password || !provider.endpoint) {
      throw new Error('Bright Data credentials and endpoint are required');
    }

    return {
      host: provider.endpoint,
      port: 22225,
      auth: {
        username: provider.username,
        password: provider.password
      }
    };
  }

  /**
   * Get Oxylabs configuration
   * @returns {Object} Oxylabs proxy config
   */
  getOxylabsConfig() {
    const provider = this.providers.oxylabs;
    if (!provider.username || !provider.password || !provider.endpoint) {
      throw new Error('Oxylabs credentials and endpoint are required');
    }

    return {
      host: provider.endpoint,
      port: 60000,
      auth: {
        username: provider.username,
        password: provider.password
      }
    };
  }

  /**
   * Get Zyte configuration
   * @returns {Object} Zyte proxy config
   */
  getZyteConfig() {
    const provider = this.providers.zyte;
    if (!provider.apiKey) {
      throw new Error('Zyte API key is required');
    }

    return {
      host: 'proxy.zyte.com',
      port: provider.port,
      auth: {
        username: 'zyte',
        password: provider.apiKey
      }
    };
  }

  /**
   * Make HTTP request with proxy support
   * @param {string} url - Target URL
   * @param {Object} options - Axios options
   * @returns {Promise<Object>} Axios response
   */
  async makeRequest(url, options = {}) {
    const proxyConfig = this.getProxyConfig();
    
    if (!proxyConfig) {
      // No proxy, make direct request
      return await this.makeDirectRequest(url, options);
    }

    // Add proxy configuration to axios options
    const requestOptions = {
      ...options,
      proxy: proxyConfig,
      timeout: this.timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        ...options.headers
      }
    };

    // Retry logic with different providers if needed
    for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
      try {
        console.log(`🌐 Making proxy request (attempt ${attempt + 1}/${this.retryAttempts}) to: ${url}`);
        console.log(`🔧 Using proxy provider: ${this.provider}`);
        
        const response = await axios.get(url, requestOptions);
        
        console.log(`✅ Proxy request successful: ${response.status}`);
        return response;
      } catch (error) {
        console.error(`❌ Proxy request failed (attempt ${attempt + 1}):`, error.message);
        
        if (attempt === this.retryAttempts - 1) {
          // Last attempt failed, try direct request as fallback
          console.log('🔄 All proxy attempts failed, trying direct request as fallback...');
          return await this.makeDirectRequest(url, options);
        }
        
        // Try rotating to next available provider
        if (this.rotateProvider()) {
          const newProxyConfig = this.getProxyConfig();
          if (newProxyConfig) {
            requestOptions.proxy = newProxyConfig;
            console.log(`🔄 Rotated to provider: ${this.provider}`);
          }
        }
        
        // Wait before retry
        await this.delay(1000 * (attempt + 1));
      }
    }
  }

  /**
   * Make direct request without proxy
   * @param {string} url - Target URL
   * @param {Object} options - Axios options
   * @returns {Promise<Object>} Axios response
   */
  async makeDirectRequest(url, options = {}) {
    console.log(`🌐 Making direct request to: ${url}`);
    
    const requestOptions = {
      ...options,
      timeout: this.timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        ...options.headers
      }
    };

    const response = await axios.get(url, requestOptions);
    console.log(`✅ Direct request successful: ${response.status}`);
    return response;
  }

  /**
   * Rotate to next available proxy provider
   * @returns {boolean} True if rotation was successful
   */
  rotateProvider() {
    const availableProviders = Object.keys(this.providers).filter(
      provider => this.providers[provider].enabled
    );

    if (availableProviders.length <= 1) {
      return false;
    }

    this.proxyRotationIndex = (this.proxyRotationIndex + 1) % availableProviders.length;
    this.provider = availableProviders[this.proxyRotationIndex];
    
    console.log(`🔄 Rotated to provider: ${this.provider}`);
    return true;
  }

  /**
   * Get current proxy status
   * @returns {Object} Proxy status information
   */
  getStatus() {
    return {
      enabled: this.proxyEnabled,
      currentProvider: this.provider,
      providers: Object.keys(this.providers).reduce((acc, key) => {
        acc[key] = {
          enabled: this.providers[key].enabled,
          configured: this.isProviderConfigured(key)
        };
        return acc;
      }, {}),
      timeout: this.timeout,
      retryAttempts: this.retryAttempts
    };
  }

  /**
   * Check if provider is properly configured
   * @param {string} provider - Provider name
   * @returns {boolean} True if configured
   */
  isProviderConfigured(provider) {
    const config = this.providers[provider];
    if (!config) return false;

    switch (provider) {
      case 'scraperapi':
        return !!config.apiKey;
      case 'brightdata':
        return !!(config.username && config.password && config.endpoint);
      case 'oxylabs':
        return !!(config.username && config.password && config.endpoint);
      case 'zyte':
        return !!config.apiKey;
      default:
        return false;
    }
  }

  /**
   * Enable/disable proxy
   * @param {boolean} enabled - Whether to enable proxy
   */
  setEnabled(enabled) {
    this.proxyEnabled = enabled;
    console.log(`🔧 Proxy ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Set proxy provider
   * @param {string} provider - Provider name
   */
  setProvider(provider) {
    if (!this.providers[provider]) {
      throw new Error(`Unknown proxy provider: ${provider}`);
    }
    
    this.provider = provider;
    console.log(`🔧 Proxy provider set to: ${provider}`);
  }

  /**
   * Utility function for delays
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise} Promise that resolves after delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Test proxy connection
   * @param {string} testUrl - URL to test with
   * @returns {Promise<Object>} Test result
   */
  async testConnection(testUrl = 'https://httpbin.org/ip') {
    try {
      console.log(`🧪 Testing proxy connection with: ${testUrl}`);
      
      const response = await this.makeRequest(testUrl);
      
      return {
        success: true,
        status: response.status,
        data: response.data,
        provider: this.provider,
        proxyEnabled: this.proxyEnabled
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        provider: this.provider,
        proxyEnabled: this.proxyEnabled
      };
    }
  }
}

export default new ProxyService();
