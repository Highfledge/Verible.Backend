import User from '../models/User.model.js';
import { generateUserToken } from '../utils/jwt.js';
import { sendOTP } from '../utils/twilio.js';
import { sendEmailOTP } from '../utils/email.js';
import { validationResult } from 'express-validator';

/**
 * Register a new user
 * POST /api/auth/register
 */
export const register = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { name, email, phone, password, role, verificationMethod } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { phone }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email or phone already exists'
      });
    }

    // Validate role
    const validRoles = ['user', 'seller', 'admin'];
    const userRole = role && validRoles.includes(role) ? role : 'user';

    // Default verification method: email for users, phone for sellers
    const defaultMethod = userRole === 'seller' ? 'phone' : 'email';
    const preferredMethod = verificationMethod || defaultMethod;

    // Create user object (not saved yet)
    const user = new User({
      name,
      email,
      phone,
      passwordHash: password, // Will be hashed by pre-save hook
      role: userRole,
      verified: false,
      verificationMethod: null
    });

    // Generate verification code
    const code = user.generateVerificationCode();

    // Try to send verification code BEFORE creating user
    try {
      if (preferredMethod === 'phone') {
        await sendOTP(phone, code);
      } else {
        //await sendEmailOTP(email, code, name);
      }
    } catch (error) {
      console.error('Failed to send verification code:', error.message);
      return res.status(500).json({
        success: false,
        message: `Failed to send verification code via ${preferredMethod}. Please try again or contact support.`,
        error: error.message
      });
    }

    // Only save user if verification code was sent successfully
    await user.save();

    // Generate JWT token
    const token = generateUserToken(user);

    res.status(201).json({
      success: true,
      message: `User registered successfully. Verification code sent via ${preferredMethod}.`,
      data: {
        user: user.toJSON(),
        token,
        verificationSent: true,
        verificationMethod: preferredMethod,
        // For testing purposes - remove in production
        verificationCode: process.env.NODE_ENV === 'development' ? code : undefined
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message
    });
  }
};

/**
 * Login user
 * POST /api/auth/login
 */
export const login = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { emailOrPhone, password } = req.body;

    // Find user by email or phone
    const user = await User.findOne({
      $or: [{ email: emailOrPhone }, { phone: emailOrPhone }]
    }).select('+passwordHash');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    if (!user.verified){
      return res.status(401).json({
        success: false,
        message: "Please verify your account"
      })
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate JWT token
    const token = generateUserToken(user);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: user.toJSON(),
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
};

/**
 * Send verification code (authenticated - for logged in users)
 * POST /api/auth/verify/send
 */
export const sendVerificationCode = async (req, res) => {
  try {
    const { method } = req.body; // 'email' or 'phone'
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.verified) {
      return res.status(400).json({
        success: false,
        message: 'User is already verified'
      });
    }

    // Generate verification code
    const code = user.generateVerificationCode();
    await user.save();

    // Validate method
    if (!method || !['email', 'phone'].includes(method)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification method. Use "email" or "phone"'
      });
    }

    // Send code based on method (non-blocking - send in background)
    if (method === 'phone') {
      sendOTP(user.phone, code).catch(error => {
        console.error('Failed to send SMS verification code:', error.message);
      });
    } else {
      sendEmailOTP(user.email, code, user.name).catch(error => {
        console.error('Failed to send email verification code:', error.message);
      });
    }

    // Respond immediately without waiting for send to complete
    res.status(200).json({
      success: true,
      message: `Verification code sent via ${method}`,
      // For testing purposes - remove in production
      ...(process.env.NODE_ENV === 'development' && { verificationCode: code })
    });
  } catch (error) {
    console.error('Verification send error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send verification code',
      error: error.message
    });
  }
};

/**
 * Resend verification code (public - no authentication required)
 * POST /api/auth/verify/resend
 */
export const resendVerificationCode = async (req, res) => {
  try {
    const { emailOrPhone, method } = req.body;

    if (!emailOrPhone) {
      return res.status(400).json({
        success: false,
        message: 'Email or phone number is required'
      });
    }

    if (!method || !['email', 'phone'].includes(method)) {
      return res.status(400).json({
        success: false,
        message: 'Valid verification method is required (email or phone)'
      });
    }

    // Find user by email or phone
    const user = await User.findOne({
      $or: [{ email: emailOrPhone.toLowerCase() }, { phone: emailOrPhone }]
    });

    if (!user) {
      // Don't reveal if user exists or not (security best practice)
      return res.status(200).json({
        success: true,
        message: `If an account exists with ${emailOrPhone}, a verification code has been sent.`
      });
    }

    if (user.verified) {
      return res.status(400).json({
        success: false,
        message: 'This account is already verified. Please login.'
      });
    }

    // Generate verification code
    const code = user.generateVerificationCode();
    await user.save();

    // Send code based on method (non-blocking - send in background)
    if (method === 'phone') {
      sendOTP(user.phone, code).catch(error => {
        console.error('Failed to send SMS verification code:', error.message);
      });
    } else {
      sendEmailOTP(user.email, code, user.name).catch(error => {
        console.error('Failed to send email verification code:', error.message);
      });
    }

    // Respond immediately without waiting for send to complete
    res.status(200).json({
      success: true,
      message: `Verification code sent via ${method}. Please check your ${method === 'email' ? 'inbox' : 'messages'}.`,
      // For testing purposes - remove in production
      ...(process.env.NODE_ENV === 'development' && { verificationCode: code })
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resend verification code',
      error: error.message
    });
  }
};

/**
 * Verify user with code (PUBLIC - no authentication required)
 * POST /api/auth/verify
 */
export const verifyUser = async (req, res) => {
  try {
    const { emailOrPhone, code } = req.body;

    if (!emailOrPhone || !code) {
      return res.status(400).json({
        success: false,
        message: 'Email/phone and verification code are required'
      });
    }

    // Find user by email or phone
    const user = await User.findOne({
      $or: [{ email: emailOrPhone.toLowerCase() }, { phone: emailOrPhone }]
    }).select('+verificationCode +verificationCodeExpires');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid credentials or verification code'
      });
    }

    if (user.verified) {
      return res.status(400).json({
        success: false,
        message: 'Account is already verified. Please login.'
      });
    }

    // Verify code
    const isCodeValid = user.verifyCode(code);
    if (!isCodeValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification code'
      });
    }

    // Update user verification status
    user.verified = true;
    user.verificationMethod = user.verificationMethod || 'email';
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    await user.save();

    // Generate token for the newly verified user
    const token = generateUserToken(user);

    res.status(200).json({
      success: true,
      message: 'Account verified successfully! You can now login.',
      data: {
        user: user.toJSON(),
        token // Optional: auto-login after verification
      }
    });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Verification failed',
      error: error.message
    });
  }
};

/**
 * Get current user profile
 * GET /api/auth/me
 */
export const getCurrentUser = async (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        user: user.toJSON()
      }
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user profile',
      error: error.message
    });
  }
};

/**
 * Refresh user token
 * POST /api/auth/refresh
 */
export const refreshToken = async (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Generate new JWT token
    const token = generateUserToken(user);

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        token
      }
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to refresh token',
      error: error.message
    });
  }
};

/**
 * Request password reset
 * POST /api/auth/password/forgot
 */
export const forgotPassword = async (req, res) => {
  try {
    const { emailOrPhone, method } = req.body;

    if (!emailOrPhone) {
      return res.status(400).json({
        success: false,
        message: 'Email or phone number is required'
      });
    }

    if (!method || !['email', 'phone'].includes(method)) {
      return res.status(400).json({
        success: false,
        message: 'Valid method is required (email or phone)'
      });
    }

    // Find user by email or phone
    const user = await User.findOne({
      $or: [{ email: emailOrPhone.toLowerCase() }, { phone: emailOrPhone }]
    });

    // Don't reveal if user exists (security best practice)
    if (!user) {
      return res.status(200).json({
        success: true,
        message: `If an account exists with ${emailOrPhone}, a password reset code has been sent.`
      });
    }

    // Check if user is verified
    if (!user.verified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your account first before resetting password.'
      });
    }

    // Generate reset token
    const resetToken = user.generatePasswordResetToken();
    await user.save();

    // Send reset code (non-blocking - send in background)
    if (method === 'phone') {
      sendOTP(user.phone, resetToken, 'reset').catch(error => {
        console.error('Failed to send SMS reset code:', error.message);
      });
    } else {
      sendEmailOTP(user.email, resetToken, user.name, 'reset').catch(error => {
        console.error('Failed to send email reset code:', error.message);
      });
    }

    // Respond immediately without waiting for send to complete
    res.status(200).json({
      success: true,
      message: `Password reset code sent via ${method}. The code will expire in 15 minutes.`,
      // For testing purposes - remove in production
      ...(process.env.NODE_ENV === 'development' && { resetCode: resetToken })
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process password reset request',
      error: error.message
    });
  }
};

/**
 * Reset password with token
 * POST /api/auth/password/reset
 */
export const resetPassword = async (req, res) => {
  try {
    const { emailOrPhone, resetToken, newPassword } = req.body;

    if (!emailOrPhone || !resetToken || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email/phone, reset code, and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Find user
    const user = await User.findOne({
      $or: [{ email: emailOrPhone.toLowerCase() }, { phone: emailOrPhone }]
    }).select('+resetPasswordToken +resetPasswordExpires');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reset code or credentials'
      });
    }

    // Check if user is verified
    if (!user.verified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your account first.'
      });
    }

    // Verify reset token
    const isTokenValid = user.verifyResetToken(resetToken);
    if (!isTokenValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset code'
      });
    }

    // Update password
    user.passwordHash = newPassword; // Will be hashed by pre-save hook
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successfully. You can now login with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset password',
      error: error.message
    });
  }
};

