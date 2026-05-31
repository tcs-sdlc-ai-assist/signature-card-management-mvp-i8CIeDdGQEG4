/**
 * AuditLogger service for SIG Card Management.
 * Provides audit logging for authentication, verification, and session events.
 * Appends entries to a mock audit log in localStorage with timestamps and sanitized details.
 * No PII (emails, phone numbers, full names) is stored in log values.
 */

import { getItem, setItem } from '../utils/storage.js';
import { generateReferenceId, formatTimestamp } from '../utils/helpers.js';
import { ACTION_TYPES } from '../constants/constants.js';

/** @type {string} Storage key for the audit log */
const AUDIT_LOG_KEY = 'audit_log';

/**
 * Patterns used to detect and sanitize PII from log detail values.
 * @type {Array<{ pattern: RegExp, replacement: string }>}
 */
const PII_PATTERNS = [
  { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '[EMAIL_REDACTED]' },
  { pattern: /\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g, replacement: '[PHONE_REDACTED]' },
  { pattern: /\+?\d{10,15}/g, replacement: '[PHONE_REDACTED]' },
  { pattern: /\d{6,}/g, replacement: '[NUMBER_REDACTED]' },
];

/**
 * Sanitizes a string value by replacing detected PII patterns.
 * @param {string} value - The string to sanitize.
 * @returns {string} The sanitized string with PII replaced.
 */
function sanitizeString(value) {
  if (typeof value !== 'string') {
    return value;
  }
  let sanitized = value;
  for (let i = 0; i < PII_PATTERNS.length; i++) {
    sanitized = sanitized.replace(PII_PATTERNS[i].pattern, PII_PATTERNS[i].replacement);
  }
  return sanitized;
}

/**
 * Recursively sanitizes an object or value, removing PII from string values.
 * @param {*} data - The data to sanitize.
 * @returns {*} The sanitized data.
 */
function sanitizeDetails(data) {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    return sanitizeString(data);
  }

  if (typeof data === 'number' || typeof data === 'boolean') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeDetails(item));
  }

  if (typeof data === 'object') {
    const sanitized = {};
    const keys = Object.keys(data);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const lowerKey = key.toLowerCase();
      if (
        lowerKey === 'email' ||
        lowerKey === 'phone' ||
        lowerKey === 'phonenumber' ||
        lowerKey === 'password' ||
        lowerKey === 'passwordhash' ||
        lowerKey === 'ssn' ||
        lowerKey === 'socialsecuritynumber'
      ) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeDetails(data[key]);
      }
    }
    return sanitized;
  }

  return data;
}

/**
 * Appends an audit log entry to the mock audit log in localStorage.
 * Sanitizes details to ensure no PII is stored in log values.
 * @param {string} eventType - The type of event (should match ACTION_TYPES values).
 * @param {string} userId - The user ID associated with the event.
 * @param {Object|string} [details={}] - Additional details about the event.
 * @returns {{ success: boolean, entryId: string|null }} Result indicating whether the log entry was appended.
 */
export function logEvent(eventType, userId, details = {}) {
  if (!eventType || typeof eventType !== 'string') {
    console.warn('AuditLogger: eventType is required and must be a string.');
    return { success: false, entryId: null };
  }

  const entryId = `audit-${generateReferenceId()}`;
  const sanitizedDetails = sanitizeDetails(details);

  const entry = {
    id: entryId,
    action: eventType,
    userId: userId || 'unknown',
    timestamp: new Date().toISOString(),
    details: typeof sanitizedDetails === 'string' ? sanitizedDetails : sanitizedDetails,
    ipAddress: '127.0.0.1',
  };

  const currentLog = getItem(AUDIT_LOG_KEY, []);

  if (!Array.isArray(currentLog)) {
    const newLog = [entry];
    const saved = setItem(AUDIT_LOG_KEY, newLog);
    return { success: saved, entryId: saved ? entryId : null };
  }

  currentLog.push(entry);
  const saved = setItem(AUDIT_LOG_KEY, currentLog);

  return { success: saved, entryId: saved ? entryId : null };
}

/**
 * Retrieves all audit log entries from localStorage.
 * @returns {Array<Object>} An array of audit log entries, sorted by timestamp (newest first).
 */
export function getAuditLog() {
  const log = getItem(AUDIT_LOG_KEY, []);

  if (!Array.isArray(log)) {
    return [];
  }

  return [...log].sort((a, b) => {
    const dateA = new Date(a.timestamp || 0).getTime();
    const dateB = new Date(b.timestamp || 0).getTime();
    return dateB - dateA;
  });
}

/**
 * Retrieves audit log entries filtered by user ID.
 * @param {string} userId - The user ID to filter by.
 * @returns {Array<Object>} An array of audit log entries for the specified user, sorted by timestamp (newest first).
 */
export function getAuditLogByUser(userId) {
  if (!userId || typeof userId !== 'string') {
    return [];
  }

  const log = getAuditLog();
  return log.filter((entry) => entry.userId === userId);
}

/**
 * Retrieves audit log entries filtered by action type.
 * @param {string} actionType - The action type to filter by (should match ACTION_TYPES values).
 * @returns {Array<Object>} An array of audit log entries for the specified action type, sorted by timestamp (newest first).
 */
export function getAuditLogByAction(actionType) {
  if (!actionType || typeof actionType !== 'string') {
    return [];
  }

  const log = getAuditLog();
  return log.filter((entry) => entry.action === actionType);
}

/**
 * Clears the entire audit log from localStorage.
 * Primarily used for testing and reset scenarios.
 * @returns {boolean} True if the log was cleared successfully, false otherwise.
 */
export function clearAuditLog() {
  return setItem(AUDIT_LOG_KEY, []);
}