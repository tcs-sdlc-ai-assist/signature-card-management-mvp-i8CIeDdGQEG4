/**
 * KycTokenValidator service for SIG Card Management.
 * Provides eSign/KYC token validation and status management.
 * Validates token format (UUID), expiration, and association with the
 * authenticated controlling party against mock KYC tokens in localStorage.
 * All events are logged via AuditLogger.
 */

import { getItem, setItem } from '../utils/storage.js';
import { logEvent } from './auditLogger.js';
import { getSession } from './authService.js';

/** @type {string} Storage key for eSign/KYC tokens */
const ESIGN_TOKENS_KEY = 'esign_tokens';

/**
 * UUID v4 format regex for token validation.
 * @type {RegExp}
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Alternate token format regex for mock tokens (e.g., "esign-tok-valid-abc123").
 * @type {RegExp}
 */
const MOCK_TOKEN_REGEX = /^esign-tok-[a-zA-Z0-9]+-[a-zA-Z0-9]+$/;

/**
 * Retrieves all stored eSign/KYC tokens from localStorage.
 * @returns {Object} The tokens object keyed by status (valid, expired, invalid).
 */
function getStoredTokens() {
  return getItem(ESIGN_TOKENS_KEY, {});
}

/**
 * Saves eSign/KYC tokens to localStorage.
 * @param {Object} tokens - The tokens object to save.
 * @returns {boolean} True if saved successfully.
 */
function saveTokens(tokens) {
  return setItem(ESIGN_TOKENS_KEY, tokens);
}

/**
 * Checks whether a token string has a valid format.
 * Accepts UUID v4 format or the mock token format used in mock data.
 * @param {string} token - The token string to validate.
 * @returns {boolean} True if the token format is valid.
 */
function isValidTokenFormat(token) {
  if (!token || typeof token !== 'string') {
    return false;
  }
  const trimmed = token.trim();
  return UUID_REGEX.test(trimmed) || MOCK_TOKEN_REGEX.test(trimmed);
}

/**
 * Finds a token entry by its token string from the stored tokens object.
 * @param {string} token - The token string to search for.
 * @returns {{ key: string, tokenData: Object }|null} The matching token entry or null.
 */
function findTokenByValue(token) {
  const tokens = getStoredTokens();

  if (!tokens || typeof tokens !== 'object') {
    return null;
  }

  const keys = Object.keys(tokens);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const entry = tokens[key];
    if (entry && entry.token === token) {
      return { key, tokenData: entry };
    }
  }

  return null;
}

/**
 * Validates a KYC/eSign token against stored mock tokens.
 * Checks token format (UUID or mock format), expiration, status,
 * and association with the currently authenticated controlling party.
 *
 * @param {string} token - The token string to validate.
 * @returns {{ valid: boolean, error: string|null, tokenData: Object|null }}
 *   Result object indicating validity, an error message on failure,
 *   and the token data on success.
 */
export function validateToken(token) {
  const session = getSession();

  if (!session) {
    logEvent('KYC_TOKEN_FAILED', 'unknown', {
      reason: 'No active session.',
    });
    return {
      valid: false,
      error: 'No active session. Please log in first.',
      tokenData: null,
    };
  }

  if (!token || typeof token !== 'string' || !token.trim()) {
    logEvent('KYC_TOKEN_FAILED', session.userId, {
      reason: 'Token is required.',
    });
    return {
      valid: false,
      error: 'Token is required.',
      tokenData: null,
    };
  }

  const trimmedToken = token.trim();

  // Validate token format
  if (!isValidTokenFormat(trimmedToken)) {
    logEvent('KYC_TOKEN_FAILED', session.userId, {
      reason: 'Invalid token format.',
    });
    return {
      valid: false,
      error: 'Invalid token format. Token must be a valid UUID or token identifier.',
      tokenData: null,
    };
  }

  // Find the token in stored data
  const found = findTokenByValue(trimmedToken);

  if (!found) {
    logEvent('KYC_TOKEN_FAILED', session.userId, {
      reason: 'Token not found.',
    });
    return {
      valid: false,
      error: 'Token not found. Please provide a valid token.',
      tokenData: null,
    };
  }

  const { tokenData } = found;

  // Check token status
  if (tokenData.status === 'invalid') {
    logEvent('KYC_TOKEN_FAILED', session.userId, {
      reason: 'Token is invalid.',
      tokenStatus: tokenData.status,
    });
    return {
      valid: false,
      error: 'This token is invalid.',
      tokenData: null,
    };
  }

  // Check token expiration
  if (tokenData.status === 'expired') {
    logEvent('KYC_TOKEN_FAILED', session.userId, {
      reason: 'Token has expired.',
      tokenStatus: tokenData.status,
    });
    return {
      valid: false,
      error: 'This token has expired. Please request a new token.',
      tokenData: null,
    };
  }

  // Check expiresAt timestamp
  if (tokenData.expiresAt) {
    const expiresAt = new Date(tokenData.expiresAt).getTime();
    if (!isNaN(expiresAt) && Date.now() > expiresAt) {
      logEvent('KYC_TOKEN_FAILED', session.userId, {
        reason: 'Token has expired based on expiration timestamp.',
        tokenStatus: tokenData.status,
      });
      return {
        valid: false,
        error: 'This token has expired. Please request a new token.',
        tokenData: null,
      };
    }
  }

  // Check association with the authenticated user
  if (tokenData.userId && tokenData.userId !== session.userId) {
    logEvent('KYC_TOKEN_FAILED', session.userId, {
      reason: 'Token is not associated with the authenticated user.',
    });
    return {
      valid: false,
      error: 'This token is not associated with your account.',
      tokenData: null,
    };
  }

  // Token is valid
  logEvent('KYC_TOKEN_VALIDATED', session.userId, {
    message: 'KYC token validated successfully.',
    tokenStatus: tokenData.status,
  });

  return {
    valid: true,
    error: null,
    tokenData: {
      token: tokenData.token,
      status: tokenData.status,
      issuedAt: tokenData.issuedAt,
      expiresAt: tokenData.expiresAt,
      userId: tokenData.userId,
    },
  };
}

/**
 * Updates the status of a KYC/eSign token.
 * Typically used to change a token from 'pending' or 'valid' to 'confirmed'.
 *
 * @param {string} token - The token string to update.
 * @param {string} status - The new status to set (e.g., 'confirmed', 'expired', 'invalid').
 * @returns {{ success: boolean, error: string|null, tokenData: Object|null }}
 *   Result object indicating success, an error message on failure,
 *   and the updated token data on success.
 */
export function updateTokenStatus(token, status) {
  const session = getSession();

  if (!session) {
    logEvent('KYC_TOKEN_FAILED', 'unknown', {
      reason: 'No active session for token status update.',
    });
    return {
      success: false,
      error: 'No active session. Please log in first.',
      tokenData: null,
    };
  }

  if (!token || typeof token !== 'string' || !token.trim()) {
    return {
      success: false,
      error: 'Token is required.',
      tokenData: null,
    };
  }

  if (!status || typeof status !== 'string' || !status.trim()) {
    return {
      success: false,
      error: 'Status is required.',
      tokenData: null,
    };
  }

  const trimmedToken = token.trim();
  const trimmedStatus = status.trim().toLowerCase();

  const validStatuses = ['valid', 'confirmed', 'expired', 'invalid', 'pending'];
  if (!validStatuses.includes(trimmedStatus)) {
    return {
      success: false,
      error: `Invalid status. Must be one of: ${validStatuses.join(', ')}.`,
      tokenData: null,
    };
  }

  // Find the token in stored data
  const found = findTokenByValue(trimmedToken);

  if (!found) {
    logEvent('KYC_TOKEN_FAILED', session.userId, {
      reason: 'Token not found for status update.',
    });
    return {
      success: false,
      error: 'Token not found. Please provide a valid token.',
      tokenData: null,
    };
  }

  const { key, tokenData } = found;

  // Check association with the authenticated user
  if (tokenData.userId && tokenData.userId !== session.userId) {
    logEvent('KYC_TOKEN_FAILED', session.userId, {
      reason: 'Token is not associated with the authenticated user for status update.',
    });
    return {
      success: false,
      error: 'This token is not associated with your account.',
      tokenData: null,
    };
  }

  // Update the token status
  const tokens = getStoredTokens();
  const previousStatus = tokenData.status;
  tokens[key] = {
    ...tokenData,
    status: trimmedStatus,
  };

  const saved = saveTokens(tokens);

  if (!saved) {
    return {
      success: false,
      error: 'Failed to update token status.',
      tokenData: null,
    };
  }

  logEvent('KYC_TOKEN_STATUS_UPDATED', session.userId, {
    message: `Token status updated from "${previousStatus}" to "${trimmedStatus}".`,
    previousStatus: previousStatus,
    newStatus: trimmedStatus,
  });

  return {
    success: true,
    error: null,
    tokenData: {
      token: tokens[key].token,
      status: tokens[key].status,
      issuedAt: tokens[key].issuedAt,
      expiresAt: tokens[key].expiresAt,
      userId: tokens[key].userId,
    },
  };
}

/**
 * Retrieves the current status of a KYC/eSign token without performing full validation.
 *
 * @param {string} token - The token string to look up.
 * @returns {{ found: boolean, status: string|null, tokenData: Object|null }}
 *   Result object indicating whether the token was found, its status, and data.
 */
export function getTokenStatus(token) {
  if (!token || typeof token !== 'string' || !token.trim()) {
    return {
      found: false,
      status: null,
      tokenData: null,
    };
  }

  const trimmedToken = token.trim();
  const found = findTokenByValue(trimmedToken);

  if (!found) {
    return {
      found: false,
      status: null,
      tokenData: null,
    };
  }

  return {
    found: true,
    status: found.tokenData.status,
    tokenData: {
      token: found.tokenData.token,
      status: found.tokenData.status,
      issuedAt: found.tokenData.issuedAt,
      expiresAt: found.tokenData.expiresAt,
      userId: found.tokenData.userId,
    },
  };
}