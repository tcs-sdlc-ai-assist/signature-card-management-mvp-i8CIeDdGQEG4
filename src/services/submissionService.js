/**
 * SubmissionService for SIG Card Management.
 * Provides staging, retrieval, clearing, and atomic submission of signer changes.
 * Supports idempotent submissions via unique tokens, audit logging, and consent tracking.
 * All state is persisted in localStorage via the storage abstraction layer.
 */

import { getItem, setItem } from '../utils/storage.js';
import { getSession } from './authService.js';
import { generateReferenceId } from '../utils/helpers.js';
import {
  logSignerAdded,
  logSignerEdited,
  logSignerRemoved,
  logSubmissionCompleted,
  logSignersConfirmed,
} from './auditLogService.js';

/** @type {string} Storage key for staged changes */
const STAGED_CHANGES_KEY = 'staged_changes';

/** @type {string} Storage key for submission tokens */
const SUBMISSION_TOKENS_KEY = 'submission_tokens';

/** @type {string} Storage key for last submission result */
const LAST_SUBMISSION_KEY = 'last_submission';

/**
 * Valid change types for staging.
 * @type {Object<string, string>}
 */
const CHANGE_TYPES = Object.freeze({
  ADD: 'add',
  EDIT: 'edit',
  REMOVE: 'remove',
});

/**
 * Retrieves all staged signer changes from localStorage.
 *
 * @returns {{ success: boolean, message: string, changes: Array<Object> }}
 *   Result object with the list of staged changes.
 */
export function getStagedChanges() {
  const session = getSession();

  if (!session) {
    return {
      success: false,
      message: 'No active session. Please log in first.',
      changes: [],
    };
  }

  const staged = getItem(STAGED_CHANGES_KEY, []);

  if (!Array.isArray(staged)) {
    return {
      success: true,
      message: 'No staged changes found.',
      changes: [],
    };
  }

  return {
    success: true,
    message: `Found ${staged.length} staged change${staged.length !== 1 ? 's' : ''}.`,
    changes: staged.map((change) => ({ ...change })),
  };
}

/**
 * Adds a change to the staging area.
 *
 * @param {string} changeType - The type of change ('add', 'edit', or 'remove').
 * @param {Object} signerData - The signer data associated with the change.
 * @param {string} [signerData.signerId] - The signer ID (required for edit/remove).
 * @param {string} [signerData.accountId] - The account ID associated with the change.
 * @param {string} [signerData.firstName] - The signer's first name.
 * @param {string} [signerData.lastName] - The signer's last name.
 * @param {Object} [signerData.before] - The state before the change (for edits).
 * @param {Object} [signerData.after] - The state after the change (for edits).
 * @returns {{ success: boolean, message: string, change: Object|null }}
 *   Result object with the staged change or null on failure.
 */
export function stageChange(changeType, signerData) {
  const session = getSession();

  if (!session) {
    return {
      success: false,
      message: 'No active session. Please log in first.',
      change: null,
    };
  }

  if (!changeType || typeof changeType !== 'string') {
    return {
      success: false,
      message: 'Change type is required.',
      change: null,
    };
  }

  const trimmedType = changeType.trim().toLowerCase();

  if (trimmedType !== CHANGE_TYPES.ADD && trimmedType !== CHANGE_TYPES.EDIT && trimmedType !== CHANGE_TYPES.REMOVE) {
    return {
      success: false,
      message: 'Invalid change type. Must be "add", "edit", or "remove".',
      change: null,
    };
  }

  if (!signerData || typeof signerData !== 'object' || Array.isArray(signerData)) {
    return {
      success: false,
      message: 'Signer data is required and must be a valid object.',
      change: null,
    };
  }

  // For edit and remove, signerId is required
  if ((trimmedType === CHANGE_TYPES.EDIT || trimmedType === CHANGE_TYPES.REMOVE) &&
      (!signerData.signerId || typeof signerData.signerId !== 'string')) {
    return {
      success: false,
      message: 'Signer ID is required for edit and remove changes.',
      change: null,
    };
  }

  const staged = getItem(STAGED_CHANGES_KEY, []);
  const currentChanges = Array.isArray(staged) ? staged : [];

  // Check for duplicate staged change for the same signer and type
  if (signerData.signerId && typeof signerData.signerId === 'string') {
    const existingIndex = currentChanges.findIndex(
      (c) => c.signerId === signerData.signerId && c.changeType === trimmedType
    );

    // If a change of the same type already exists for this signer, replace it
    if (existingIndex !== -1) {
      const updatedChange = {
        ...currentChanges[existingIndex],
        ...signerData,
        changeType: trimmedType,
        updatedAt: new Date().toISOString(),
      };

      currentChanges[existingIndex] = updatedChange;
      const saved = setItem(STAGED_CHANGES_KEY, currentChanges);

      if (!saved) {
        return {
          success: false,
          message: 'Failed to update staged change.',
          change: null,
        };
      }

      return {
        success: true,
        message: 'Staged change updated successfully.',
        change: { ...updatedChange },
      };
    }
  }

  const change = {
    id: `change-${generateReferenceId()}`,
    changeType: trimmedType,
    signerId: signerData.signerId || null,
    accountId: signerData.accountId || null,
    firstName: signerData.firstName || null,
    lastName: signerData.lastName || null,
    signerData: { ...signerData },
    before: signerData.before || null,
    after: signerData.after || null,
    stagedAt: new Date().toISOString(),
    stagedBy: session.userId,
  };

  currentChanges.push(change);
  const saved = setItem(STAGED_CHANGES_KEY, currentChanges);

  if (!saved) {
    return {
      success: false,
      message: 'Failed to stage change.',
      change: null,
    };
  }

  return {
    success: true,
    message: 'Change staged successfully.',
    change: { ...change },
  };
}

/**
 * Clears all staged changes from localStorage.
 *
 * @returns {{ success: boolean, message: string }}
 *   Result object indicating whether the staging area was cleared.
 */
export function clearStagedChanges() {
  const session = getSession();

  if (!session) {
    return {
      success: false,
      message: 'No active session. Please log in first.',
    };
  }

  const saved = setItem(STAGED_CHANGES_KEY, []);

  if (!saved) {
    return {
      success: false,
      message: 'Failed to clear staged changes.',
    };
  }

  return {
    success: true,
    message: 'Staged changes cleared successfully.',
  };
}

/**
 * Removes a specific staged change by its ID.
 *
 * @param {string} changeId - The ID of the staged change to remove.
 * @returns {{ success: boolean, message: string }}
 *   Result object indicating whether the change was removed.
 */
export function removeStagedChange(changeId) {
  const session = getSession();

  if (!session) {
    return {
      success: false,
      message: 'No active session. Please log in first.',
    };
  }

  if (!changeId || typeof changeId !== 'string') {
    return {
      success: false,
      message: 'Change ID is required.',
    };
  }

  const trimmedId = changeId.trim();
  const staged = getItem(STAGED_CHANGES_KEY, []);

  if (!Array.isArray(staged)) {
    return {
      success: false,
      message: 'No staged changes found.',
    };
  }

  const index = staged.findIndex((c) => c.id === trimmedId);

  if (index === -1) {
    return {
      success: false,
      message: 'Staged change not found.',
    };
  }

  staged.splice(index, 1);
  const saved = setItem(STAGED_CHANGES_KEY, staged);

  if (!saved) {
    return {
      success: false,
      message: 'Failed to remove staged change.',
    };
  }

  return {
    success: true,
    message: 'Staged change removed successfully.',
  };
}

/**
 * Generates a unique idempotency token for submission.
 *
 * @returns {string} A unique submission token.
 */
export function generateSubmissionToken() {
  return `submit-${generateReferenceId()}`;
}

/**
 * Checks whether a submission token has already been used.
 *
 * @param {string} token - The submission token to check.
 * @returns {boolean} True if the token has been used, false otherwise.
 */
function isTokenUsed(token) {
  if (!token || typeof token !== 'string') {
    return false;
  }

  const tokens = getItem(SUBMISSION_TOKENS_KEY, {});

  if (!tokens || typeof tokens !== 'object') {
    return false;
  }

  return tokens[token] === true;
}

/**
 * Marks a submission token as used.
 *
 * @param {string} token - The submission token to mark as used.
 * @returns {boolean} True if marked successfully.
 */
function markTokenUsed(token) {
  if (!token || typeof token !== 'string') {
    return false;
  }

  const tokens = getItem(SUBMISSION_TOKENS_KEY, {});
  const currentTokens = tokens && typeof tokens === 'object' ? tokens : {};

  currentTokens[token] = true;
  return setItem(SUBMISSION_TOKENS_KEY, currentTokens);
}

/**
 * Processes all staged changes atomically, generates a reference ID,
 * records a timestamp, prevents duplicate submissions via idempotency token,
 * and logs all changes via AuditLogService.
 *
 * @param {string} accountId - The account ID to submit changes for.
 * @param {Array<Object>} stagedChanges - The array of staged changes to submit.
 * @param {boolean} consentGiven - Whether the user has given consent for the submission.
 * @param {string} [submissionToken] - An optional idempotency token. If not provided, one will be generated.
 * @returns {{ success: boolean, message: string, referenceId: string|null, summary: Object|null, timestamp: string|null }}
 *   Result object with the submission reference ID, summary, and timestamp.
 */
export function submitChanges(accountId, stagedChanges, consentGiven, submissionToken) {
  const session = getSession();

  if (!session) {
    return {
      success: false,
      message: 'No active session. Please log in first.',
      referenceId: null,
      summary: null,
      timestamp: null,
    };
  }

  if (!accountId || typeof accountId !== 'string') {
    return {
      success: false,
      message: 'Account ID is required.',
      referenceId: null,
      summary: null,
      timestamp: null,
    };
  }

  if (!consentGiven) {
    return {
      success: false,
      message: 'Consent is required to submit changes.',
      referenceId: null,
      summary: null,
      timestamp: null,
    };
  }

  if (!Array.isArray(stagedChanges) || stagedChanges.length === 0) {
    return {
      success: false,
      message: 'No staged changes to submit.',
      referenceId: null,
      summary: null,
      timestamp: null,
    };
  }

  // Idempotency check
  const token = submissionToken || generateSubmissionToken();

  if (isTokenUsed(token)) {
    // Return the last submission result if available
    const lastSubmission = getItem(LAST_SUBMISSION_KEY, null);

    if (lastSubmission && lastSubmission.token === token) {
      return {
        success: true,
        message: 'This submission has already been processed.',
        referenceId: lastSubmission.referenceId,
        summary: lastSubmission.summary,
        timestamp: lastSubmission.timestamp,
      };
    }

    return {
      success: false,
      message: 'Duplicate submission detected. This submission has already been processed.',
      referenceId: null,
      summary: null,
      timestamp: null,
    };
  }

  const trimmedAccountId = accountId.trim();
  const referenceId = `REF-${generateReferenceId()}`;
  const timestamp = new Date().toISOString();

  // Build summary
  const summary = {
    totalChanges: stagedChanges.length,
    added: 0,
    edited: 0,
    removed: 0,
    details: [],
  };

  // Process each staged change and log via AuditLogService
  for (let i = 0; i < stagedChanges.length; i++) {
    const change = stagedChanges[i];

    if (!change || typeof change !== 'object') {
      continue;
    }

    const changeType = change.changeType || '';
    const signerName = [change.firstName, change.lastName].filter(Boolean).join(' ') ||
      (change.signerData ? [change.signerData.firstName, change.signerData.lastName].filter(Boolean).join(' ') : 'Unknown');

    const detail = {
      changeType: changeType,
      signerId: change.signerId || null,
      signerName: signerName,
    };

    if (changeType === CHANGE_TYPES.ADD) {
      summary.added += 1;
      logSignerAdded(session.userId, {
        accountId: trimmedAccountId,
        signerId: change.signerId || 'new',
        signerName: signerName,
        referenceId: referenceId,
        message: `Signer ${signerName} added via submission ${referenceId}.`,
      });
    } else if (changeType === CHANGE_TYPES.EDIT) {
      summary.edited += 1;
      logSignerEdited(session.userId, {
        accountId: trimmedAccountId,
        signerId: change.signerId,
        signerName: signerName,
        before: change.before || {},
        after: change.after || {},
        referenceId: referenceId,
        message: `Signer ${signerName} edited via submission ${referenceId}.`,
      });
    } else if (changeType === CHANGE_TYPES.REMOVE) {
      summary.removed += 1;
      logSignerRemoved(session.userId, {
        accountId: trimmedAccountId,
        signerId: change.signerId,
        signerName: signerName,
        referenceId: referenceId,
        message: `Signer ${signerName} removed via submission ${referenceId}.`,
      });
    }

    summary.details.push(detail);
  }

  // Log signers confirmed
  logSignersConfirmed(session.userId, {
    accountId: trimmedAccountId,
    signerCount: stagedChanges.length,
    referenceId: referenceId,
    message: `${stagedChanges.length} signer change${stagedChanges.length !== 1 ? 's' : ''} confirmed for submission.`,
  });

  // Log submission completed
  logSubmissionCompleted(session.userId, {
    accountId: trimmedAccountId,
    referenceId: referenceId,
    totalChanges: summary.totalChanges,
    added: summary.added,
    edited: summary.edited,
    removed: summary.removed,
    consentGiven: true,
    message: `Submission ${referenceId} completed with ${summary.totalChanges} change${summary.totalChanges !== 1 ? 's' : ''}.`,
  });

  // Mark token as used
  markTokenUsed(token);

  // Store last submission result for idempotency lookups
  const submissionResult = {
    token: token,
    referenceId: referenceId,
    accountId: trimmedAccountId,
    summary: summary,
    timestamp: timestamp,
    userId: session.userId,
    consentGiven: true,
  };

  setItem(LAST_SUBMISSION_KEY, submissionResult);

  // Clear staged changes after successful submission
  setItem(STAGED_CHANGES_KEY, []);

  return {
    success: true,
    message: 'Submission completed successfully.',
    referenceId: referenceId,
    summary: summary,
    timestamp: timestamp,
  };
}

/**
 * Retrieves the last submission result from localStorage.
 *
 * @returns {{ success: boolean, message: string, submission: Object|null }}
 *   Result object with the last submission data or null if not found.
 */
export function getLastSubmission() {
  const session = getSession();

  if (!session) {
    return {
      success: false,
      message: 'No active session. Please log in first.',
      submission: null,
    };
  }

  const lastSubmission = getItem(LAST_SUBMISSION_KEY, null);

  if (!lastSubmission) {
    return {
      success: true,
      message: 'No previous submission found.',
      submission: null,
    };
  }

  return {
    success: true,
    message: 'Last submission retrieved successfully.',
    submission: { ...lastSubmission },
  };
}

/**
 * Resets all submission state including staged changes, tokens, and last submission.
 * Primarily used for testing and workflow reset scenarios.
 *
 * @returns {{ success: boolean, message: string }}
 *   Result object indicating whether the reset succeeded.
 */
export function resetSubmissionState() {
  const session = getSession();

  if (!session) {
    return {
      success: false,
      message: 'No active session. Please log in first.',
    };
  }

  const clearedStaged = setItem(STAGED_CHANGES_KEY, []);
  const clearedTokens = setItem(SUBMISSION_TOKENS_KEY, {});
  const clearedLast = setItem(LAST_SUBMISSION_KEY, null);

  if (!clearedStaged || !clearedTokens || !clearedLast) {
    return {
      success: false,
      message: 'Failed to reset submission state.',
    };
  }

  return {
    success: true,
    message: 'Submission state reset successfully.',
  };
}