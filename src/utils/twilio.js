import twilio from 'twilio';

let twilioClient = null;

/**
 * Initialize Twilio client
 */
const initTwilio = () => {
  if (!twilioClient && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }
  return twilioClient;
};

/**
 * Send OTP via SMS using Twilio
 * @param {String} phone - Phone number to send OTP to
 * @param {String} code - Verification code
 * @param {String} type - Type of code: 'verification' or 'reset'
 * @returns {Promise} Twilio message object
 */
export const sendOTP = async (phone, code, type = 'verification') => {
  try {
    const client = initTwilio();
    
    if (!client) {
      throw new Error('Twilio is not configured. Please set TWILIO credentials.');
    }

    const isPasswordReset = type === 'reset';
    const expiryTime = isPasswordReset ? '15 minutes' : '10 minutes';
    const messageText = isPasswordReset 
      ? `Your Verible password reset code is: ${code}. This code will expire in ${expiryTime}.`
      : `Your Verible verification code is: ${code}. This code will expire in ${expiryTime}.`;

    const message = await client.messages.create({
      body: messageText,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone
    });

    console.log(`OTP sent to ${phone}: ${message.sid}`);
    return message;
  } catch (error) {
    console.error('Twilio error:', error.message);
    throw new Error('Failed to send OTP via SMS');
  }
};

/**
 * Verify phone number format
 * @param {String} phone - Phone number to validate
 * @returns {Boolean}
 */
export const isValidPhone = (phone) => {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone);
};

