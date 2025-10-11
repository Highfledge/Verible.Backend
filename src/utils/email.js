import { Resend } from 'resend';

let resendClient = null;

/**
 * Initialize Resend client
 */
const initResend = () => {
  if (!resendClient && process.env.RESEND_API_KEY) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
};

/**
 * Send OTP via email using Resend
 * @param {String} email - Email address to send OTP to
 * @param {String} code - Verification code
 * @param {String} name - User's name
 * @param {String} type - Type of code: 'verification' or 'reset'
 * @returns {Promise}
 */
export const sendEmailOTP = async (email, code, name = 'User', type = 'verification') => {
  try {
    const resend = initResend();
    
    if (!resend) {
      throw new Error('Resend is not configured. Please set RESEND_API_KEY in your environment variables.');
    }

    const isPasswordReset = type === 'reset';
    const subject = isPasswordReset ? 'Verible - Password Reset Code' : 'Verible - Email Verification Code';
    const expiryTime = isPasswordReset ? '15 minutes' : '10 minutes';
    const title = isPasswordReset ? 'Password Reset Request' : 'Email Verification';
    const message = isPasswordReset 
      ? 'You requested to reset your password. Your reset code is:' 
      : 'Your verification code is:';

    const emailPayload = {
      from: process.env.EMAIL_FROM || 'Verible <onboarding@resend.dev>',
      to: email,
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Hello ${name},</h2>
          <p style="font-size: 16px; color: #555;">
            ${message}
          </p>
          <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; color: #333; letter-spacing: 5px;">
              ${code}
            </span>
          </div>
          <p style="font-size: 14px; color: #777;">
            This code will expire in ${expiryTime}. Please do not share this code with anyone.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="font-size: 12px; color: #999;">
            If you didn't request this code, please ignore this email.
          </p>
        </div>
      `
    };

    console.log('Sending email with payload:', { from: emailPayload.from, to: emailPayload.to, subject: emailPayload.subject });

    const { data, error } = await resend.emails.send(emailPayload);

    if (error) {
      console.error('Resend API error:', JSON.stringify(error, null, 2));
      throw new Error(error.message || 'Failed to send email');
    }

    console.log(`Email OTP sent to ${email}: ${data.id}`);
    return data;
  } catch (error) {
    console.error('Email error:', error);
    // Preserve the original error message
    throw error;
  }
};

/**
 * Validate email format
 * @param {String} email - Email to validate
 * @returns {Boolean}
 */
export const isValidEmail = (email) => {
  const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
  return emailRegex.test(email);
};

