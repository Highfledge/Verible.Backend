import profileExtractionService from '../services/profileExtraction.service.js';

/**
 * Proxy Management Controller
 * Handles proxy configuration and testing
 */

/**
 * Get proxy status and configuration
 * GET /api/proxy/status
 */
export const getProxyStatus = async (req, res) => {
  try {
    const status = profileExtractionService.getProxyStatus();
    
    res.status(200).json({
      success: true,
      message: 'Proxy status retrieved successfully',
      data: status
    });
  } catch (error) {
    console.error('Get proxy status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get proxy status',
      error: error.message
    });
  }
};

/**
 * Test proxy connection
 * POST /api/proxy/test
 */
export const testProxyConnection = async (req, res) => {
  try {
    const { testUrl } = req.body;
    
    const result = await profileExtractionService.testProxyConnection(testUrl);
    
    res.status(200).json({
      success: true,
      message: 'Proxy test completed',
      data: result
    });
  } catch (error) {
    console.error('Test proxy connection error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test proxy connection',
      error: error.message
    });
  }
};

/**
 * Enable/disable proxy
 * POST /api/proxy/toggle
 */
export const toggleProxy = async (req, res) => {
  try {
    const { enabled } = req.body;
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'enabled must be a boolean value'
      });
    }
    
    profileExtractionService.setProxyEnabled(enabled);
    
    res.status(200).json({
      success: true,
      message: `Proxy ${enabled ? 'enabled' : 'disabled'} successfully`,
      data: {
        enabled
      }
    });
  } catch (error) {
    console.error('Toggle proxy error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle proxy',
      error: error.message
    });
  }
};

/**
 * Set proxy provider
 * POST /api/proxy/provider
 */
export const setProxyProvider = async (req, res) => {
  try {
    const { provider } = req.body;
    
    if (!provider) {
      return res.status(400).json({
        success: false,
        message: 'provider is required'
      });
    }
    
    const validProviders = ['scraperapi', 'brightdata', 'oxylabs', 'zyte'];
    if (!validProviders.includes(provider)) {
      return res.status(400).json({
        success: false,
        message: `Invalid provider. Must be one of: ${validProviders.join(', ')}`
      });
    }
    
    profileExtractionService.setProxyProvider(provider);
    
    res.status(200).json({
      success: true,
      message: `Proxy provider set to ${provider} successfully`,
      data: {
        provider
      }
    });
  } catch (error) {
    console.error('Set proxy provider error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set proxy provider',
      error: error.message
    });
  }
};

/**
 * Test profile extraction with proxy
 * POST /api/proxy/test-extraction
 */
export const testProfileExtraction = async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'url is required'
      });
    }
    
    console.log(`🧪 Testing profile extraction with proxy for: ${url}`);
    
    const result = await profileExtractionService.extractProfile(url);
    
    res.status(200).json({
      success: true,
      message: 'Profile extraction test completed',
      data: {
        url,
        result,
        proxyStatus: profileExtractionService.getProxyStatus()
      }
    });
  } catch (error) {
    console.error('Test profile extraction error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test profile extraction',
      error: error.message
    });
  }
};
