import express from 'express';
import { 
  getProxyStatus, 
  testProxyConnection, 
  toggleProxy, 
  setProxyProvider, 
  testProfileExtraction 
} from '../controllers/proxy.controller.js';
import { isAuthenticated } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * @route   GET /api/proxy/status
 * @desc    Get proxy status and configuration
 * @access  Private (Admin only)
 */
router.get('/status', isAuthenticated, getProxyStatus);

/**
 * @route   POST /api/proxy/test
 * @desc    Test proxy connection
 * @access  Private (Admin only)
 */
router.post('/test', isAuthenticated, testProxyConnection);

/**
 * @route   POST /api/proxy/toggle
 * @desc    Enable/disable proxy
 * @access  Private (Admin only)
 */
router.post('/toggle', isAuthenticated, toggleProxy);

/**
 * @route   POST /api/proxy/provider
 * @desc    Set proxy provider
 * @access  Private (Admin only)
 */
router.post('/provider', isAuthenticated, setProxyProvider);

/**
 * @route   POST /api/proxy/test-extraction
 * @desc    Test profile extraction with proxy
 * @access  Private (Admin only)
 */
router.post('/test-extraction', isAuthenticated, testProfileExtraction);

export default router;
