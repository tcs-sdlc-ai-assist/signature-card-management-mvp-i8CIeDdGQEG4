/**
 * SessionManager service for SIG Card Management.
 * Provides session lifecycle management including creation, retrieval,
 * activity tracking, expiration checks, and warning thresholds.
 * All state is persisted in localStorage via the storage abstraction layer.
 */

import { getItem, setItem, removeItem } from '../utils/storage.js';
import { generateReferenceId } from '../utils/helpers.js';
import { logEvent } from './auditLogger.js';
import { ACTION_TYPES } from '../constants/constants.js';
import { SESSION_TIMEOUT_MS, SESSION_WARNING_MS, TOKEN_EXPIRY_MS } from '../config.js';

/** @type {string} Storage key for the current session */
const SESSION_KEY = 'auth_session';

/**
 * Creates a new session for the given user ID and stores it in localStorage.
 * The session includes creation time, expiration time, and last activity timestamp.
 *
 * @param {string} userId - The user ID to create a session for.
 * @returns {{ success: boolean, session: Object|null }} Result with the created session object or null on failure.
 */
export function createSession(userId) {
  if (!userId || typeof userId !== 'string') {
    console.warn('SessionManager: userId is required and must be a string.');
    return { success: false, session: null };
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + TOKEN_EXPIRY_MS);

  const session = {
    sessionToken: `session-${generateReferenceId()}`,
    userId: userId,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    lastActivity: now.toISOString(),
    isAuthenticated: true,
    identityVerified: false,
  };

  const saved = setItem(SESSION_KEY, session);

  if (!saved) {
    console.error('SessionManager: Failed to save session to localStorage.');
    return { success: false, session: null };
  }

  return { success: true, session: session };
}

/**
 * Retrieves the current session from localStorage.
 * Returns null if no session exists or if the session token expiry has passed.
 *
 * @returns {Object|null} The session object, or null if not found or expired.
 */
export function getSession() {
  const session = getItem(SESSION_KEY, null);

  if (!session) {
    return null;
  }

  // Check if the session token has expired (hard expiry)
  if (session.expiresAt) {
    const expiresAt = new Date(session.expiresAt).getTime();
    if (Date.now() > expiresAt) {
      logEvent(ACTION_TYPES.SESSION_EXPIRED, session.userId, {
        message: 'Session token expired.',
      });
      removeItem(SESSION_KEY);
      return null;
    }
  }

  return session;
}

/**
 * Updates the lastActivity timestamp on the current session.
 * Used to track user activity for session timeout calculations.
 *
 * @returns {boolean} True if the session was updated, false if no active session exists.
 */
export function updateActivity() {
  const session = getSession();

  if (!session) {
    return false;
  }

  session.lastActivity = new Date().toISOString();
  return setItem(SESSION_KEY, session);
}

/**
 * Invalidates the current session by removing it from localStorage.
 * Logs a SESSION_EXPIRED event via AuditLogger.
 *
 * @returns {boolean} True if the session was invalidated successfully.
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

/**
 * Checks whether the current session has expired based on inactivity.
 * Compares the elapsed time since lastActivity against SESSION_TIMEOUT_MS.
 *
 * @returns {boolean} True if the session has expired due to inactivity, false otherwise.
 */
export function isSessionExpired() {
  const session = getSession();

  if (!session) {
    return true;
  }

  if (!session.lastActivity) {
    return true;
  }

  const lastActivity = new Date(session.lastActivity).getTime();
  if (isNaN(lastActivity)) {
    return true;
  }

  const elapsed = Date.now() - lastActivity;
  return elapsed >= SESSION_TIMEOUT_MS;
}

/**
 * Checks whether the current session is within the warning threshold before timeout.
 * Returns true if the elapsed time since lastActivity has passed SESSION_WARNING_MS
 * but has not yet reached SESSION_TIMEOUT_MS.
 *
 * @returns {boolean} True if the session is in the warning period, false otherwise.
 */
export function isSessionWarning() {
  const session = getSession();

  if (!session) {
    return false;
  }

  if (!session.lastActivity) {
    return false;
  }

  const lastActivity = new Date(session.lastActivity).getTime();
  if (isNaN(lastActivity)) {
    return false;
  }

  const elapsed = Date.now() - lastActivity;
  return elapsed >= SESSION_WARNING_MS && elapsed < SESSION_TIMEOUT_MS;
}