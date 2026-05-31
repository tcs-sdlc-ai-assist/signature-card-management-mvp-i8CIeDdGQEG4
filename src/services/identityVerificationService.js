/**
 * IdentityVerificationService for SIG Card Management.
 * Provides OTP generation, verification, resend with cooldown enforcement,
 * and delivery method retrieval. All state is persisted in localStorage.
 * All events are logged via AuditLogger.
 */

import { getItem, setItem } from '../utils/storage.js';
import { generateOtp as generateOtpCode } from '../utils/helpers.js';
import { logEvent } from './auditLogger.js';
import { ACTION_TYPES } from '../constants/constants.js';
import { OTP_EXPIRY_MS, OTP_MAX_ATTEMPTS, OTP_RESEND_COOLDOWN_MS, OTP_MAX_RESENDS } from '../config.js';
import { getSession, markIdentityVerified } from './authService.js';
import { getResendAttemptMessage } from '../constants/constants.js';

/** @type {string} Storage key for the current OTP data */
const OTP_KEY = 'otp_data';

/** @type {string} Storage key for rate limits */
const RATE_LIMITS_KEY = 'rate_limits';

/** @type {string} Storage key for OTP contacts */
const OTP_CONTACTS_KEY = 'otp_contacts';

/**
 * Retrieves the current rate limits from localStorage.
 * @returns {Object} The rate limits object.
 */
function getRateLimits() {
  return getItem(RATE_LIMITS_KEY, {
    loginAttempts: 0,
    loginLastAttemptDate: null,
    otpAttempts: 0,
    otpResendAttempts: 0,
    otpResendLastDate: null,
    unlockAttempts: 0,
    unlockLastDate: null,
  });
}

/**
 * Saves rate limits to localStorage.
 * @param {Object} rateLimits - The rate limits object to save.
 * @returns {boolean} True if saved successfully.
 */
function saveRateLimits(rateLimits) {
  return setItem(RATE_LIMITS_KEY, rateLimits);
}

/**
 * Retrieves the stored OTP data from localStorage.
 * @returns {Object|null} The OTP data object, or null if not found.
 */
function getStoredOtp() {
  return getItem(OTP_KEY, null);
}

/**
 * Saves OTP data to localStorage.
 * @param {Object} otpData - The OTP data object to save.
 * @returns {boolean} True if saved successfully.
 */
function saveOtpData(otpData) {
  return setItem(OTP_KEY, otpData);
}

/**
 * Returns the available OTP delivery methods with masked contact information.
 * @returns {Array<Object>} An array of delivery method objects with id, method, label, and masked value.
 */
export function getDeliveryMethods() {
  const contacts = getItem(OTP_CONTACTS_KEY, []);

  if (!Array.isArray(contacts) || contacts.length === 0) {
    return [];
  }

  return contacts.map((contact) => ({
    id: contact.id,
    method: contact.method,
    label: contact.label,
    masked: contact.masked,
  }));
}

/**
 * Generates a 6-digit OTP code, stores it with expiry in localStorage,
 * and logs the event via AuditLogger.
 *
 * @param {string} deliveryMethod - The delivery method ('sms' or 'email').
 * @returns {{ success: boolean, message: string, otp: string|null, expiresAt: string|null }}
 *   Result object with the generated OTP (for mock/demo purposes), expiry timestamp, and status.
 */
export function generateOtp(deliveryMethod) {
  const session = getSession();

  if (!session) {
    return {
      success: false,
      message: 'No active session. Please log in first.',
      otp: null,
      expiresAt: null,
    };
  }

  if (!deliveryMethod || typeof deliveryMethod !== 'string') {
    return {
      success: false,
      message: 'Delivery method is required.',
      otp: null,
      expiresAt: null,
    };
  }

  const trimmedMethod = deliveryMethod.trim().toLowerCase();

  if (trimmedMethod !== 'sms' && trimmedMethod !== 'email') {
    return {
      success: false,
      message: 'Invalid delivery method. Must be "sms" or "email".',
      otp: null,
      expiresAt: null,
    };
  }

  const otpCode = generateOtpCode();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MS);

  const otpData = {
    code: otpCode,
    userId: session.userId,
    deliveryMethod: trimmedMethod,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    attempts: 0,
    verified: false,
  };

  saveOtpData(otpData);

  // Reset OTP attempts in rate limits
  const rateLimits = getRateLimits();
  rateLimits.otpAttempts = 0;
  saveRateLimits(rateLimits);

  logEvent(ACTION_TYPES.OTP_REQUESTED, session.userId, {
    deliveryMethod: trimmedMethod,
    message: 'OTP generated and sent.',
  });

  return {
    success: true,
    message: `OTP has been sent via ${trimmedMethod}.`,
    otp: otpCode,
    expiresAt: expiresAt.toISOString(),
  };
}

/**
 * Verifies the provided OTP code against the stored OTP.
 * Tracks verification attempts and handles expiry.
 * Marks the session as identity-verified on success.
 *
 * @param {string} code - The 6-digit OTP code to verify.
 * @returns {{ success: boolean, message: string, remainingAttempts: number|null }}
 *   Result object indicating success/failure, a user-facing message,
 *   and remaining attempts on failure.
 */
export function verifyOtp(code) {
  const session = getSession();

  if (!session) {
    return {
      success: false,
      message: 'No active session. Please log in first.',
      remainingAttempts: null,
    };
  }

  if (!code || typeof code !== 'string' || !code.trim()) {
    return {
      success: false,
      message: 'OTP code is required.',
      remainingAttempts: null,
    };
  }

  const trimmedCode = code.trim();

  // Validate format
  if (!/^\d{6}$/.test(trimmedCode)) {
    return {
      success: false,
      message: 'OTP must be exactly 6 digits.',
      remainingAttempts: null,
    };
  }

  const otpData = getStoredOtp();

  if (!otpData) {
    return {
      success: false,
      message: 'No OTP has been generated. Please request a new OTP.',
      remainingAttempts: null,
    };
  }

  // Check if OTP has already been verified
  if (otpData.verified) {
    return {
      success: false,
      message: 'This OTP has already been used. Please request a new OTP.',
      remainingAttempts: null,
    };
  }

  // Check if OTP has expired
  if (otpData.expiresAt) {
    const expiresAt = new Date(otpData.expiresAt).getTime();
    if (Date.now() > expiresAt) {
      logEvent(ACTION_TYPES.OTP_FAILED, session.userId, {
        reason: 'OTP expired.',
      });
      return {
        success: false,
        message: 'OTP has expired. Please request a new OTP.',
        remainingAttempts: null,
      };
    }
  }

  // Check if max attempts exceeded
  const rateLimits = getRateLimits();
  if (rateLimits.otpAttempts >= OTP_MAX_ATTEMPTS) {
    logEvent(ACTION_TYPES.OTP_FAILED, session.userId, {
      reason: 'Maximum OTP verification attempts exceeded.',
    });
    return {
      success: false,
      message: 'You have exceeded the maximum number of OTP verification attempts. Please request a new OTP.',
      remainingAttempts: 0,
    };
  }

  // Validate the OTP code
  if (otpData.code !== trimmedCode) {
    // Increment attempts
    rateLimits.otpAttempts = (rateLimits.otpAttempts || 0) + 1;
    saveRateLimits(rateLimits);

    otpData.attempts = (otpData.attempts || 0) + 1;
    saveOtpData(otpData);

    const remaining = Math.max(0, OTP_MAX_ATTEMPTS - rateLimits.otpAttempts);

    logEvent(ACTION_TYPES.OTP_FAILED, session.userId, {
      reason: 'Invalid OTP code.',
      attemptNumber: rateLimits.otpAttempts,
      remainingAttempts: remaining,
    });

    if (remaining === 0) {
      return {
        success: false,
        message: 'You have exceeded the maximum number of OTP verification attempts. Please request a new OTP.',
        remainingAttempts: 0,
      };
    }

    return {
      success: false,
      message: `Invalid OTP code. You have ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`,
      remainingAttempts: remaining,
    };
  }

  // OTP is valid — mark as verified
  otpData.verified = true;
  saveOtpData(otpData);

  // Reset OTP attempts
  rateLimits.otpAttempts = 0;
  saveRateLimits(rateLimits);

  // Mark session as identity verified
  markIdentityVerified();

  logEvent(ACTION_TYPES.OTP_VERIFIED, session.userId, {
    message: 'OTP verified successfully.',
  });

  return {
    success: true,
    message: 'Identity verified successfully.',
    remainingAttempts: null,
  };
}

/**
 * Resends a new OTP with cooldown enforcement and max resend limits.
 * Generates a new OTP code and resets verification attempts.
 *
 * @param {string} deliveryMethod - The delivery method ('sms' or 'email').
 * @returns {{ success: boolean, message: string, otp: string|null, expiresAt: string|null, remainingResends: number|null }}
 *   Result object with the new OTP (for mock/demo purposes), expiry, status, and remaining resends.
 */
export function resendOtp(deliveryMethod) {
  const session = getSession();

  if (!session) {
    return {
      success: false,
      message: 'No active session. Please log in first.',
      otp: null,
      expiresAt: null,
      remainingResends: null,
    };
  }

  if (!deliveryMethod || typeof deliveryMethod !== 'string') {
    return {
      success: false,
      message: 'Delivery method is required.',
      otp: null,
      expiresAt: null,
      remainingResends: null,
    };
  }

  const trimmedMethod = deliveryMethod.trim().toLowerCase();

  if (trimmedMethod !== 'sms' && trimmedMethod !== 'email') {
    return {
      success: false,
      message: 'Invalid delivery method. Must be "sms" or "email".',
      otp: null,
      expiresAt: null,
      remainingResends: null,
    };
  }

  const rateLimits = getRateLimits();

  // Check max resend limit
  if (rateLimits.otpResendAttempts >= OTP_MAX_RESENDS) {
    const attemptMessages = getResendAttemptMessage(rateLimits.otpResendAttempts, OTP_MAX_RESENDS);

    logEvent(ACTION_TYPES.OTP_FAILED, session.userId, {
      reason: 'Maximum OTP resend attempts exceeded.',
    });

    return {
      success: false,
      message: attemptMessages.error,
      otp: null,
      expiresAt: null,
      remainingResends: 0,
    };
  }

  // Check cooldown period
  if (rateLimits.otpResendLastDate) {
    const lastResend = new Date(rateLimits.otpResendLastDate).getTime();
    if (!isNaN(lastResend)) {
      const elapsed = Date.now() - lastResend;
      if (elapsed < OTP_RESEND_COOLDOWN_MS) {
        const remainingSeconds = Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsed) / 1000);
        return {
          success: false,
          message: `Please wait ${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''} before requesting a new OTP.`,
          otp: null,
          expiresAt: null,
          remainingResends: Math.max(0, OTP_MAX_RESENDS - rateLimits.otpResendAttempts),
        };
      }
    }
  }

  // Increment resend attempts
  rateLimits.otpResendAttempts = (rateLimits.otpResendAttempts || 0) + 1;
  rateLimits.otpResendLastDate = new Date().toISOString();
  rateLimits.otpAttempts = 0;
  saveRateLimits(rateLimits);

  // Generate new OTP
  const otpCode = generateOtpCode();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MS);

  const otpData = {
    code: otpCode,
    userId: session.userId,
    deliveryMethod: trimmedMethod,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    attempts: 0,
    verified: false,
  };

  saveOtpData(otpData);

  const remainingResends = Math.max(0, OTP_MAX_RESENDS - rateLimits.otpResendAttempts);
  const attemptMessages = getResendAttemptMessage(rateLimits.otpResendAttempts, OTP_MAX_RESENDS);

  logEvent(ACTION_TYPES.OTP_RESENT, session.userId, {
    deliveryMethod: trimmedMethod,
    resendAttempt: rateLimits.otpResendAttempts,
    remainingResends: remainingResends,
    message: 'OTP resent successfully.',
  });

  return {
    success: true,
    message: attemptMessages.success,
    otp: otpCode,
    expiresAt: expiresAt.toISOString(),
    remainingResends: remainingResends,
  };
}

/**
 * Returns the current OTP verification status.
 * @returns {{ hasOtp: boolean, isVerified: boolean, isExpired: boolean, attemptsUsed: number, resendsUsed: number }}
 */
export function getVerificationStatus() {
  const otpData = getStoredOtp();
  const rateLimits = getRateLimits();

  if (!otpData) {
    return {
      hasOtp: false,
      isVerified: false,
      isExpired: false,
      attemptsUsed: 0,
      resendsUsed: rateLimits.otpResendAttempts || 0,
    };
  }

  let isExpired = false;
  if (otpData.expiresAt) {
    const expiresAt = new Date(otpData.expiresAt).getTime();
    isExpired = Date.now() > expiresAt;
  }

  return {
    hasOtp: true,
    isVerified: otpData.verified === true,
    isExpired: isExpired,
    attemptsUsed: rateLimits.otpAttempts || 0,
    resendsUsed: rateLimits.otpResendAttempts || 0,
  };
}

/**
 * Resets the OTP verification state.
 * Clears stored OTP data and resets OTP-related rate limits.
 * @returns {boolean} True if reset successfully.
 */
export function resetVerification() {
  const rateLimits = getRateLimits();
  rateLimits.otpAttempts = 0;
  rateLimits.otpResendAttempts = 0;
  rateLimits.otpResendLastDate = null;
  saveRateLimits(rateLimits);

  return setItem(OTP_KEY, null);
}