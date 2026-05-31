/**
 * AuthService for SIG Card Management.
 * Provides login/logout, failed attempt tracking, account lockout,
 * and session creation. All state is persisted in localStorage.
 */

import { getItem, setItem, removeItem } from '../utils/storage.js';
import { logEvent } from './auditLogger.js';
import { ACTION_TYPES } from '../constants/constants.js';
import { MAX_LOGIN_ATTEMPTS, TOKEN_EXPIRY_MS } from '../config.js';
import { generateReferenceId, getCalendarDayKey } from '../utils/helpers.js';

/** @type {string} Storage key for the current authenticated session */
const SESSION_KEY = 'auth_session';

/** @type {string} Storage key for rate limits (includes login attempts) */
const RATE_LIMITS_KEY = 'rate_limits';

/**
 * Retrieves the mock user from localStorage.
 * @returns {Object|null} The mock user object, or null if not found.
 */
function getMockUser() {
  return getItem('user', null);
}

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
 * Checks whether the account associated with the given username is locked
 * due to exceeding the maximum number of failed login attempts.
 * @param {string} username - The username to check.
 * @returns {boolean} True if the account is locked, false otherwise.
 */
export function isLocked(username) {
  if (!username || typeof username !== 'string') {
    return false;
  }

  const user = getMockUser();
  if (!user || user.username !== username) {
    return false;
  }

  const rateLimits = getRateLimits();
  const today = getCalendarDayKey();

  // Reset attempts if the last attempt was on a different day
  if (rateLimits.loginLastAttemptDate && rateLimits.loginLastAttemptDate !== today) {
    rateLimits.loginAttempts = 0;
    rateLimits.loginLastAttemptDate = null;
    saveRateLimits(rateLimits);
    return false;
  }

  return rateLimits.loginAttempts >= MAX_LOGIN_ATTEMPTS;
}

/**
 * Returns the number of failed login attempts for the given username.
 * Resets the count if the last attempt was on a different calendar day.
 * @param {string} username - The username to check.
 * @returns {number} The number of failed login attempts.
 */
export function getFailedAttempts(username) {
  if (!username || typeof username !== 'string') {
    return 0;
  }

  const user = getMockUser();
  if (!user || user.username !== username) {
    return 0;
  }

  const rateLimits = getRateLimits();
  const today = getCalendarDayKey();

  // Reset attempts if the last attempt was on a different day
  if (rateLimits.loginLastAttemptDate && rateLimits.loginLastAttemptDate !== today) {
    rateLimits.loginAttempts = 0;
    rateLimits.loginLastAttemptDate = null;
    saveRateLimits(rateLimits);
    return 0;
  }

  return rateLimits.loginAttempts || 0;
}

/**
 * Resets the failed login attempts counter for the given username.
 * @param {string} username - The username to reset attempts for.
 * @returns {boolean} True if reset successfully, false otherwise.
 */
export function resetFailedAttempts(username) {
  if (!username || typeof username !== 'string') {
    return false;
  }

  const user = getMockUser();
  if (!user || user.username !== username) {
    return false;
  }

  const rateLimits = getRateLimits();
  rateLimits.loginAttempts = 0;
  rateLimits.loginLastAttemptDate = null;
  return saveRateLimits(rateLimits);
}

/**
 * Authenticates a user with the provided username and password.
 * Validates credentials against mock user data, tracks failed attempts,
 * locks the account after MAX_LOGIN_ATTEMPTS, creates a session on success,
 * and logs all events via AuditLogger.
 *
 * @param {string} username - The username to authenticate.
 * @param {string} password - The password to authenticate.
 * @returns {{ success: boolean, message: string, session: Object|null, remainingAttempts: number|null }}
 *   Result object indicating success/failure, a user-facing message,
 *   the session object on success, and remaining attempts on failure.
 */
export function login(username, password) {
  // Validate inputs
  if (!username || typeof username !== 'string' || !username.trim()) {
    return {
      success: false,
      message: 'Username is required.',
      session: null,
      remainingAttempts: null,
    };
  }

  if (!password || typeof password !== 'string' || !password.trim()) {
    return {
      success: false,
      message: 'Password is required.',
      session: null,
      remainingAttempts: null,
    };
  }

  const trimmedUsername = username.trim();

  // Check if account is locked
  if (isLocked(trimmedUsername)) {
    logEvent(ACTION_TYPES.LOGIN_FAILED, trimmedUsername, {
      reason: 'Account locked due to too many failed attempts.',
    });
    return {
      success: false,
      message: 'Your account has been locked due to too many failed login attempts. Please try again tomorrow or contact support.',
      session: null,
      remainingAttempts: 0,
    };
  }

  // Find the mock user
  const user = getMockUser();
  if (!user) {
    return {
      success: false,
      message: 'Invalid username or password.',
      session: null,
      remainingAttempts: null,
    };
  }

  // Validate credentials
  if (user.username !== trimmedUsername || user.password !== password) {
    // Increment failed attempts
    const rateLimits = getRateLimits();
    const today = getCalendarDayKey();

    // Reset if different day
    if (rateLimits.loginLastAttemptDate && rateLimits.loginLastAttemptDate !== today) {
      rateLimits.loginAttempts = 0;
    }

    rateLimits.loginAttempts = (rateLimits.loginAttempts || 0) + 1;
    rateLimits.loginLastAttemptDate = today;
    saveRateLimits(rateLimits);

    const remaining = Math.max(0, MAX_LOGIN_ATTEMPTS - rateLimits.loginAttempts);

    logEvent(ACTION_TYPES.LOGIN_FAILED, trimmedUsername, {
      reason: 'Invalid credentials.',
      attemptNumber: rateLimits.loginAttempts,
      remainingAttempts: remaining,
    });

    // Check if now locked
    if (rateLimits.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
      return {
        success: false,
        message: 'Your account has been locked due to too many failed login attempts. Please try again tomorrow or contact support.',
        session: null,
        remainingAttempts: 0,
      };
    }

    return {
      success: false,
      message: 'Invalid username or password.',
      session: null,
      remainingAttempts: remaining,
    };
  }

  // Successful login — reset failed attempts
  resetFailedAttempts(trimmedUsername);

  // Create session
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TOKEN_EXPIRY_MS);

  const session = {
    sessionToken: `session-${generateReferenceId()}`,
    userId: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    lastActivity: now.toISOString(),
    isAuthenticated: true,
    identityVerified: false,
  };

  setItem(SESSION_KEY, session);

  logEvent(ACTION_TYPES.LOGIN, user.id, {
    message: 'User logged in successfully.',
  });

  return {
    success: true,
    message: 'Login successful.',
    session: session,
    remainingAttempts: null,
  };
}

/**
 * Logs out the current user by clearing the session from localStorage
 * and logging the event via AuditLogger.
 * @returns {{ success: boolean, message: string }}
 */
export function logout() {
  const session = getSession();

  if (session) {
    logEvent(ACTION_TYPES.LOGOUT, session.userId, {
      message: 'User logged out.',
    });
  }

  removeItem(SESSION_KEY);

  return {
    success: true,
    message: 'Logged out successfully.',
  };
}

/**
 * Retrieves the current authenticated session from localStorage.
 * Returns null if no session exists or if the session has expired.
 * @returns {Object|null} The session object, or null if not found or expired.
 */
export function getSession() {
  const session = getItem(SESSION_KEY, null);

  if (!session) {
    return null;
  }

  // Check if session has expired
  if (session.expiresAt) {
    const expiresAt = new Date(session.expiresAt).getTime();
    if (Date.now() > expiresAt) {
      logEvent(ACTION_TYPES.SESSION_EXPIRED, session.userId, {
        message: 'Session expired.',
      });
      removeItem(SESSION_KEY);
      return null;
    }
  }

  return session;
}

/**
 * Updates the last activity timestamp on the current session.
 * Used to track user activity for session timeout purposes.
 * @returns {boolean} True if the session was updated, false if no active session.
 */
export function updateSessionActivity() {
  const session = getSession();

  if (!session) {
    return false;
  }

  session.lastActivity = new Date().toISOString();
  return setItem(SESSION_KEY, session);
}

/**
 * Marks the current session as identity-verified.
 * Called after successful OTP/KBA verification.
 * @returns {boolean} True if the session was updated, false if no active session.
 */
export function markIdentityVerified() {
  const session = getSession();

  if (!session) {
    return false;
  }

  session.identityVerified = true;
  session.lastActivity = new Date().toISOString();
  return setItem(SESSION_KEY, session);
}

/**
 * Checks whether there is a valid, non-expired authenticated session.
 * @returns {boolean} True if an active session exists.
 */
export function isAuthenticated() {
  const session = getSession();
  return session !== null && session.isAuthenticated === true;
}

/**
 * Checks whether the current session has completed identity verification.
 * @returns {boolean} True if identity has been verified.
 */
export function isIdentityVerified() {
  const session = getSession();
  return session !== null && session.identityVerified === true;
}

/**
 * Extends the current session expiry by the configured TOKEN_EXPIRY_MS.
 * Logs a SESSION_EXTENDED event via AuditLogger.
 * @returns {boolean} True if the session was extended, false if no active session.
 */
export function extendSession() {
  const session = getSession();

  if (!session) {
    return false;
  }

  const now = new Date();
  session.expiresAt = new Date(now.getTime() + TOKEN_EXPIRY_MS).toISOString();
  session.lastActivity = now.toISOString();

  const saved = setItem(SESSION_KEY, session);

  if (saved) {
    logEvent(ACTION_TYPES.SESSION_EXTENDED, session.userId, {
      message: 'Session extended.',
    });
  }

  return saved;
}

/**
 * Invalidates the current session due to timeout.
 * Logs a SESSION_EXPIRED event and removes the session from localStorage.
 * @returns {boolean} True if the session was invalidated.
 */
export function invalidateSession() {
  const session = getItem(SESSION_KEY, null);

  if (session) {
    logEvent(ACTION_TYPES.SESSION_EXPIRED, session.userId, {
      message: 'Session invalidated due to inactivity.',
    });
  }

  return removeItem(SESSION_KEY);
}