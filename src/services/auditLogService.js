/**
 * AuditLogService for Signer Management cluster (Cluster 2).
 * Provides audit logging for signer CRUD, unlock/resend, and submission events.
 * Wraps the core auditLogger service with signer-specific convenience methods
 * and filtering capabilities.
 * No PII (emails, phone numbers, full names) is stored in log values.
 */

import { logEvent, getAuditLog, getAuditLogByUser, getAuditLogByAction } from './auditLogger.js';
import { getSession } from './authService.js';
import { ACTION_TYPES } from '../constants/constants.js';

/**
 * Logs a signer-related action to the audit log.
 * Delegates to the core auditLogger.logEvent with sanitization.
 *
 * @param {string} actionType - The type of action (should match ACTION_TYPES values).
 * @param {string} userId - The user ID associated with the action.
 * @param {Object|string} [details={}] - Additional details about the action.
 * @param {string} [details.accountId] - The account ID related to the action.
 * @param {string} [details.signerId] - The signer ID related to the action.
 * @param {string} [details.signerName] - The signer name (will be sanitized).
 * @param {string} [details.message] - A human-readable description of the action.
 * @param {Object} [details.before] - The state before the action (for edits).
 * @param {Object} [details.after] - The state after the action (for edits).
 * @param {string} [details.referenceId] - A unique reference ID for the action.
 * @returns {{ success: boolean, entryId: string|null }} Result indicating whether the log entry was appended.
 */
export function logAction(actionType, userId, details = {}) {
  if (!actionType || typeof actionType !== 'string') {
    console.warn('AuditLogService: actionType is required and must be a string.');
    return { success: false, entryId: null };
  }

  // If no userId provided, attempt to get from session
  let resolvedUserId = userId;
  if (!resolvedUserId || typeof resolvedUserId !== 'string') {
    const session = getSession();
    resolvedUserId = session ? session.userId : 'unknown';
  }

  return logEvent(actionType, resolvedUserId, details);
}

/**
 * Retrieves audit log entries with optional filtering.
 * Supports filtering by userId, actionType, accountId, signerId, and date range.
 *
 * @param {Object} [filters={}] - Optional filter criteria.
 * @param {string} [filters.userId] - Filter by user ID.
 * @param {string} [filters.actionType] - Filter by action type (e.g., ACTION_TYPES.SIGNER_ADDED).
 * @param {string} [filters.accountId] - Filter by account ID in details.
 * @param {string} [filters.signerId] - Filter by signer ID in details.
 * @param {string} [filters.startDate] - Filter entries on or after this ISO date string.
 * @param {string} [filters.endDate] - Filter entries on or before this ISO date string.
 * @param {number} [filters.limit] - Maximum number of entries to return.
 * @returns {Array<Object>} An array of audit log entries matching the filters, sorted by timestamp (newest first).
 */
export function getLogs(filters = {}) {
  let logs;

  // Start with the most specific filter to reduce iteration
  if (filters && filters.userId && typeof filters.userId === 'string') {
    logs = getAuditLogByUser(filters.userId);
  } else if (filters && filters.actionType && typeof filters.actionType === 'string') {
    logs = getAuditLogByAction(filters.actionType);
  } else {
    logs = getAuditLog();
  }

  if (!Array.isArray(logs)) {
    return [];
  }

  // If we filtered by userId above but also have actionType, apply it
  if (filters && filters.userId && filters.actionType && typeof filters.actionType === 'string') {
    const actionFilter = filters.actionType;
    logs = logs.filter((entry) => entry.action === actionFilter);
  }

  // Filter by accountId in details
  if (filters && filters.accountId && typeof filters.accountId === 'string') {
    const accountIdFilter = filters.accountId.trim();
    logs = logs.filter((entry) => {
      if (!entry.details || typeof entry.details !== 'object') {
        return false;
      }
      return entry.details.accountId === accountIdFilter;
    });
  }

  // Filter by signerId in details
  if (filters && filters.signerId && typeof filters.signerId === 'string') {
    const signerIdFilter = filters.signerId.trim();
    logs = logs.filter((entry) => {
      if (!entry.details || typeof entry.details !== 'object') {
        return false;
      }
      return entry.details.signerId === signerIdFilter;
    });
  }

  // Filter by date range
  if (filters && filters.startDate && typeof filters.startDate === 'string') {
    const startTime = new Date(filters.startDate).getTime();
    if (!isNaN(startTime)) {
      logs = logs.filter((entry) => {
        const entryTime = new Date(entry.timestamp || 0).getTime();
        return !isNaN(entryTime) && entryTime >= startTime;
      });
    }
  }

  if (filters && filters.endDate && typeof filters.endDate === 'string') {
    const endTime = new Date(filters.endDate).getTime();
    if (!isNaN(endTime)) {
      logs = logs.filter((entry) => {
        const entryTime = new Date(entry.timestamp || 0).getTime();
        return !isNaN(entryTime) && entryTime <= endTime;
      });
    }
  }

  // Apply limit
  if (filters && filters.limit && typeof filters.limit === 'number' && filters.limit > 0) {
    logs = logs.slice(0, filters.limit);
  }

  return logs;
}

/**
 * Logs a signer addition event.
 *
 * @param {string} userId - The user ID performing the action.
 * @param {Object} details - Details about the added signer.
 * @param {string} details.accountId - The account ID.
 * @param {string} details.signerId - The new signer ID.
 * @param {string} [details.signerName] - The signer's name.
 * @param {string} [details.message] - A description of the action.
 * @returns {{ success: boolean, entryId: string|null }}
 */
export function logSignerAdded(userId, details) {
  return logAction(ACTION_TYPES.SIGNER_ADDED, userId, details);
}

/**
 * Logs a signer edit event.
 *
 * @param {string} userId - The user ID performing the action.
 * @param {Object} details - Details about the edit.
 * @param {string} details.accountId - The account ID.
 * @param {string} details.signerId - The signer ID.
 * @param {Object} [details.before] - The state before the edit.
 * @param {Object} [details.after] - The state after the edit.
 * @param {string} [details.message] - A description of the action.
 * @returns {{ success: boolean, entryId: string|null }}
 */
export function logSignerEdited(userId, details) {
  return logAction(ACTION_TYPES.SIGNER_EDITED, userId, details);
}

/**
 * Logs a signer removal event.
 *
 * @param {string} userId - The user ID performing the action.
 * @param {Object} details - Details about the removal.
 * @param {string} details.accountId - The account ID.
 * @param {string} details.signerId - The signer ID.
 * @param {string} [details.signerName] - The signer's name.
 * @param {string} [details.message] - A description of the action.
 * @returns {{ success: boolean, entryId: string|null }}
 */
export function logSignerRemoved(userId, details) {
  return logAction(ACTION_TYPES.SIGNER_REMOVED, userId, details);
}

/**
 * Logs a card unlock event.
 *
 * @param {string} userId - The user ID performing the action.
 * @param {Object} details - Details about the unlock.
 * @param {string} details.accountId - The account ID.
 * @param {string} details.signerId - The signer ID.
 * @param {number} [details.attemptNumber] - The current attempt number.
 * @param {number} [details.remainingAttempts] - Remaining attempts for the day.
 * @param {string} [details.message] - A description of the action.
 * @returns {{ success: boolean, entryId: string|null }}
 */
export function logCardUnlocked(userId, details) {
  return logAction(ACTION_TYPES.CARD_UNLOCKED, userId, details);
}

/**
 * Logs a card unlock failure event.
 *
 * @param {string} userId - The user ID performing the action.
 * @param {Object} details - Details about the failure.
 * @param {string} details.accountId - The account ID.
 * @param {string} details.signerId - The signer ID.
 * @param {string} [details.reason] - The reason for the failure.
 * @returns {{ success: boolean, entryId: string|null }}
 */
export function logCardUnlockFailed(userId, details) {
  return logAction(ACTION_TYPES.CARD_UNLOCK_FAILED, userId, details);
}

/**
 * Logs a submission completed event.
 *
 * @param {string} userId - The user ID performing the action.
 * @param {Object} details - Details about the submission.
 * @param {string} details.accountId - The account ID.
 * @param {string} [details.referenceId] - The submission reference ID.
 * @param {string} [details.message] - A description of the action.
 * @returns {{ success: boolean, entryId: string|null }}
 */
export function logSubmissionCompleted(userId, details) {
  return logAction(ACTION_TYPES.SUBMISSION_COMPLETED, userId, details);
}

/**
 * Logs a signers confirmed event.
 *
 * @param {string} userId - The user ID performing the action.
 * @param {Object} details - Details about the confirmation.
 * @param {string} details.accountId - The account ID.
 * @param {number} [details.signerCount] - The number of signers confirmed.
 * @param {string} [details.message] - A description of the action.
 * @returns {{ success: boolean, entryId: string|null }}
 */
export function logSignersConfirmed(userId, details) {
  return logAction(ACTION_TYPES.SIGNERS_CONFIRMED, userId, details);
}

/**
 * Retrieves audit log entries for a specific account.
 *
 * @param {string} accountId - The account ID to filter by.
 * @returns {Array<Object>} An array of audit log entries for the account, sorted by timestamp (newest first).
 */
export function getLogsByAccount(accountId) {
  if (!accountId || typeof accountId !== 'string') {
    return [];
  }

  return getLogs({ accountId: accountId });
}

/**
 * Retrieves audit log entries for a specific signer.
 *
 * @param {string} signerId - The signer ID to filter by.
 * @returns {Array<Object>} An array of audit log entries for the signer, sorted by timestamp (newest first).
 */
export function getLogsBySigner(signerId) {
  if (!signerId || typeof signerId !== 'string') {
    return [];
  }

  return getLogs({ signerId: signerId });
}