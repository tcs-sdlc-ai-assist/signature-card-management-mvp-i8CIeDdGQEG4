/**
 * SignerService for SIG Card Management.
 * Provides signer retrieval, add, edit, remove, unlock, resend invitation,
 * sorting, and filtering. All state is persisted in localStorage.
 * All actions are logged via AuditLogger.
 */

import { getItem, setItem } from '../utils/storage.js';
import { getSession } from './authService.js';
import { logEvent } from './auditLogger.js';
import { ACTION_TYPES, SIGNER_STATUSES, getUnlockAttemptMessage, getResendAttemptMessage } from '../constants/constants.js';
import { UNLOCK_MAX_DAILY, RESEND_MAX_DAILY } from '../config.js';
import { generateReferenceId, getCalendarDayKey } from '../utils/helpers.js';
import { validateRequired, validateName, validateEmail, validatePhone } from '../utils/validators.js';

/** @type {string} Storage key for signers */
const SIGNERS_KEY = 'signers';

/** @type {string} Storage key for rate limits */
const RATE_LIMITS_KEY = 'rate_limits';

/** @type {string} Storage key for accounts */
const ACCOUNTS_KEY = 'accounts';

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
 * Retrieves all signers from localStorage.
 * @returns {Object} The signers object keyed by account ID.
 */
function getAllSigners() {
  return getItem(SIGNERS_KEY, {});
}

/**
 * Saves all signers to localStorage.
 * @param {Object} signers - The signers object keyed by account ID.
 * @returns {boolean} True if saved successfully.
 */
function saveAllSigners(signers) {
  return setItem(SIGNERS_KEY, signers);
}

/**
 * Updates the signer count on the corresponding account.
 * @param {string} accountId - The account ID to update.
 * @param {number} count - The new signer count.
 * @returns {boolean} True if updated successfully.
 */
function updateAccountSignerCount(accountId, count) {
  const accounts = getItem(ACCOUNTS_KEY, []);
  if (!Array.isArray(accounts)) {
    return false;
  }
  const index = accounts.findIndex((acct) => acct.id === accountId);
  if (index === -1) {
    return false;
  }
  accounts[index].signerCount = count;
  return setItem(ACCOUNTS_KEY, accounts);
}

/**
 * Counts active (non-removed) signers for an account.
 * @param {Array<Object>} signers - The signers array.
 * @returns {number} The count of non-removed signers.
 */
function countActiveSigners(signers) {
  if (!Array.isArray(signers)) {
    return 0;
  }
  return signers.filter((s) => s.status !== SIGNER_STATUSES.REMOVED).length;
}

/**
 * Finds a signer by ID across all accounts.
 * @param {string} signerId - The signer ID to find.
 * @returns {{ accountId: string, signer: Object, index: number }|null} The signer info or null.
 */
function findSignerById(signerId) {
  const allSigners = getAllSigners();
  const accountIds = Object.keys(allSigners);

  for (let i = 0; i < accountIds.length; i++) {
    const accountId = accountIds[i];
    const signers = allSigners[accountId];
    if (!Array.isArray(signers)) {
      continue;
    }
    for (let j = 0; j < signers.length; j++) {
      if (signers[j].id === signerId) {
        return { accountId, signer: signers[j], index: j };
      }
    }
  }

  return null;
}

/**
 * Retrieves all authorized signers for a given account.
 *
 * @param {string} accountId - The account ID to retrieve signers for.
 * @returns {{ success: boolean, message: string, signers: Array<Object> }}
 *   Result object with the list of signers.
 */
export function getSigners(accountId) {
  const session = getSession();

  if (!session) {
    return {
      success: false,
      message: 'No active session. Please log in first.',
      signers: [],
    };
  }

  if (!accountId || typeof accountId !== 'string') {
    return {
      success: false,
      message: 'Account ID is required.',
      signers: [],
    };
  }

  const trimmedId = accountId.trim();
  const allSigners = getAllSigners();

  if (!allSigners || typeof allSigners !== 'object') {
    return {
      success: false,
      message: 'Failed to retrieve signers.',
      signers: [],
    };
  }

  const accountSigners = allSigners[trimmedId];

  if (!Array.isArray(accountSigners)) {
    return {
      success: true,
      message: 'No signers found for this account.',
      signers: [],
    };
  }

  // Return only non-removed signers by default
  const activeSigners = accountSigners.filter(
    (s) => s.status !== SIGNER_STATUSES.REMOVED
  );

  return {
    success: true,
    message: `Found ${activeSigners.length} signer${activeSigners.length !== 1 ? 's' : ''}.`,
    signers: activeSigners.map((s) => ({ ...s })),
  };
}

/**
 * Adds a new signer to an account with 'pending' status.
 *
 * @param {string} accountId - The account ID to add the signer to.
 * @param {Object} signerData - The signer data.
 * @param {string} signerData.firstName - The signer's first name.
 * @param {string} signerData.lastName - The signer's last name.
 * @param {string} [signerData.middleName] - The signer's middle name.
 * @param {string} [signerData.suffix] - The signer's suffix.
 * @param {string} [signerData.title] - The signer's title/role.
 * @param {string} signerData.email - The signer's email address.
 * @param {string} signerData.phone - The signer's phone number.
 * @param {string} [signerData.additionalContact] - Additional contact info.
 * @returns {{ success: boolean, message: string, signer: Object|null }}
 *   Result object with the created signer or null on failure.
 */
export function addSigner(accountId, signerData) {
  const session = getSession();

  if (!session) {
    return {
      success: false,
      message: 'No active session. Please log in first.',
      signer: null,
    };
  }

  if (!accountId || typeof accountId !== 'string') {
    return {
      success: false,
      message: 'Account ID is required.',
      signer: null,
    };
  }

  if (!signerData || typeof signerData !== 'object') {
    return {
      success: false,
      message: 'Signer data is required.',
      signer: null,
    };
  }

  // Validate required fields
  const firstNameCheck = validateName(signerData.firstName, 'First name');
  if (!firstNameCheck.valid) {
    return { success: false, message: firstNameCheck.message, signer: null };
  }

  const lastNameCheck = validateName(signerData.lastName, 'Last name');
  if (!lastNameCheck.valid) {
    return { success: false, message: lastNameCheck.message, signer: null };
  }

  const emailCheck = validateEmail(signerData.email);
  if (!emailCheck.valid) {
    return { success: false, message: emailCheck.message, signer: null };
  }

  const phoneCheck = validatePhone(signerData.phone);
  if (!phoneCheck.valid) {
    return { success: false, message: phoneCheck.message, signer: null };
  }

  const trimmedAccountId = accountId.trim();
  const allSigners = getAllSigners();

  if (!allSigners[trimmedAccountId]) {
    allSigners[trimmedAccountId] = [];
  }

  const accountSigners = allSigners[trimmedAccountId];

  // Check for duplicate email within the same account (non-removed signers)
  const trimmedEmail = String(signerData.email).trim().toLowerCase();
  const duplicate = accountSigners.find(
    (s) =>
      s.status !== SIGNER_STATUSES.REMOVED &&
      s.email &&
      s.email.toLowerCase() === trimmedEmail
  );

  if (duplicate) {
    return {
      success: false,
      message: 'A signer with this email address already exists on this account.',
      signer: null,
    };
  }

  const now = new Date();
  const newSigner = {
    id: `sig-${generateReferenceId()}`,
    firstName: String(signerData.firstName).trim(),
    lastName: String(signerData.lastName).trim(),
    middleName: signerData.middleName ? String(signerData.middleName).trim() : '',
    suffix: signerData.suffix ? String(signerData.suffix).trim() : '',
    role: signerData.title || signerData.role || 'Authorized Signer',
    status: SIGNER_STATUSES.PENDING,
    email: String(signerData.email).trim(),
    phone: String(signerData.phone).trim(),
    additionalContact: signerData.additionalContact ? String(signerData.additionalContact).trim() : '',
    cardStatus: 'pending',
    addedDate: now.toISOString(),
    invitationToken: `invite-${generateReferenceId()}`,
    lastInvitationSent: now.toISOString(),
    unlockAttempts: 0,
    unlockLastDate: null,
    resendAttempts: 0,
    resendLastDate: null,
  };

  accountSigners.push(newSigner);
  allSigners[trimmedAccountId] = accountSigners;

  const saved = saveAllSigners(allSigners);

  if (!saved) {
    return {
      success: false,
      message: 'Failed to save signer.',
      signer: null,
    };
  }

  // Update account signer count
  const activeCount = countActiveSigners(accountSigners);
  updateAccountSignerCount(trimmedAccountId, activeCount);

  logEvent(ACTION_TYPES.SIGNER_ADDED, session.userId, {
    accountId: trimmedAccountId,
    signerId: newSigner.id,
    signerName: `${newSigner.firstName} ${newSigner.lastName}`,
    message: `Signer ${newSigner.firstName} ${newSigner.lastName} added to account.`,
  });

  return {
    success: true,
    message: 'Signer added to pending confirmation list.',
    signer: { ...newSigner },
  };
}

/**
 * Edits an existing signer's fields and tracks changes (before/after).
 *
 * @param {string} signerId - The signer ID to edit.
 * @param {Object} updates - The fields to update.
 * @returns {{ success: boolean, message: string, signer: Object|null, changes: Object|null }}
 *   Result object with the updated signer, tracked changes, or null on failure.
 */
export function editSigner(signerId, updates) {
  const session = getSession();

  if (!session) {
    return {
      success: false,
      message: 'No active session. Please log in first.',
      signer: null,
      changes: null,
    };
  }

  if (!signerId || typeof signerId !== 'string') {
    return {
      success: false,
      message: 'Signer ID is required.',
      signer: null,
      changes: null,
    };
  }

  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    return {
      success: false,
      message: 'Updates must be a valid object.',
      signer: null,
      changes: null,
    };
  }

  const trimmedSignerId = signerId.trim();
  const found = findSignerById(trimmedSignerId);

  if (!found) {
    return {
      success: false,
      message: 'Signer not found.',
      signer: null,
      changes: null,
    };
  }

  const { accountId, signer, index } = found;

  if (signer.status === SIGNER_STATUSES.REMOVED) {
    return {
      success: false,
      message: 'Cannot edit a removed signer.',
      signer: null,
      changes: null,
    };
  }

  // Validate updatable fields if provided
  if (updates.firstName !== undefined) {
    const check = validateName(updates.firstName, 'First name');
    if (!check.valid) {
      return { success: false, message: check.message, signer: null, changes: null };
    }
  }

  if (updates.lastName !== undefined) {
    const check = validateName(updates.lastName, 'Last name');
    if (!check.valid) {
      return { success: false, message: check.message, signer: null, changes: null };
    }
  }

  if (updates.email !== undefined) {
    const check = validateEmail(updates.email);
    if (!check.valid) {
      return { success: false, message: check.message, signer: null, changes: null };
    }

    // Check for duplicate email within the same account
    const allSigners = getAllSigners();
    const accountSigners = allSigners[accountId] || [];
    const trimmedEmail = String(updates.email).trim().toLowerCase();
    const duplicate = accountSigners.find(
      (s) =>
        s.id !== trimmedSignerId &&
        s.status !== SIGNER_STATUSES.REMOVED &&
        s.email &&
        s.email.toLowerCase() === trimmedEmail
    );

    if (duplicate) {
      return {
        success: false,
        message: 'A signer with this email address already exists on this account.',
        signer: null,
        changes: null,
      };
    }
  }

  if (updates.phone !== undefined) {
    const check = validatePhone(updates.phone);
    if (!check.valid) {
      return { success: false, message: check.message, signer: null, changes: null };
    }
  }

  // Track before/after changes
  const allowedFields = [
    'firstName', 'lastName', 'middleName', 'suffix', 'role',
    'email', 'phone', 'additionalContact', 'title',
  ];

  const before = {};
  const after = {};
  let hasChanges = false;

  for (let i = 0; i < allowedFields.length; i++) {
    const field = allowedFields[i];
    if (updates[field] !== undefined) {
      const newValue = String(updates[field]).trim();
      const signerField = field === 'title' ? 'role' : field;
      const oldValue = signer[signerField] || '';

      if (oldValue !== newValue) {
        before[signerField] = oldValue;
        after[signerField] = newValue;
        hasChanges = true;
      }
    }
  }

  if (!hasChanges) {
    return {
      success: true,
      message: 'No changes detected.',
      signer: { ...signer },
      changes: null,
    };
  }

  // Apply updates
  const allSigners = getAllSigners();
  const accountSigners = allSigners[accountId];
  const updatedSigner = { ...accountSigners[index] };

  const afterKeys = Object.keys(after);
  for (let i = 0; i < afterKeys.length; i++) {
    const key = afterKeys[i];
    updatedSigner[key] = after[key];
  }

  accountSigners[index] = updatedSigner;
  allSigners[accountId] = accountSigners;

  const saved = saveAllSigners(allSigners);

  if (!saved) {
    return {
      success: false,
      message: 'Failed to save signer updates.',
      signer: null,
      changes: null,
    };
  }

  logEvent(ACTION_TYPES.SIGNER_EDITED, session.userId, {
    accountId: accountId,
    signerId: trimmedSignerId,
    signerName: `${updatedSigner.firstName} ${updatedSigner.lastName}`,
    before: before,
    after: after,
    message: `Signer ${updatedSigner.firstName} ${updatedSigner.lastName} updated.`,
  });

  return {
    success: true,
    message: 'Signer updated successfully.',
    signer: { ...updatedSigner },
    changes: { before, after },
  };
}

/**
 * Stages a signer for removal. Validates that the signer is not the last
 * non-removed signer on the account.
 *
 * @param {string} signerId - The signer ID to remove.
 * @returns {{ success: boolean, message: string }}
 *   Result object indicating success or failure.
 */
export function removeSigner(signerId) {
  const session = getSession();

  if (!session) {
    return {
      success: false,
      message: 'No active session. Please log in first.',
    };
  }

  if (!signerId || typeof signerId !== 'string') {
    return {
      success: false,
      message: 'Signer ID is required.',
    };
  }

  const trimmedSignerId = signerId.trim();
  const found = findSignerById(trimmedSignerId);

  if (!found) {
    return {
      success: false,
      message: 'Signer not found.',
    };
  }

  const { accountId, signer, index } = found;

  if (signer.status === SIGNER_STATUSES.REMOVED) {
    return {
      success: false,
      message: 'Signer has already been removed.',
    };
  }

  // Validate not the last signer
  const allSigners = getAllSigners();
  const accountSigners = allSigners[accountId];
  const activeCount = countActiveSigners(accountSigners);

  if (activeCount <= 1) {
    return {
      success: false,
      message: 'Cannot remove the last signer on an account. At least one signer must remain.',
    };
  }

  // Stage for removal
  const signerName = `${signer.firstName} ${signer.lastName}`;
  accountSigners[index] = {
    ...signer,
    status: SIGNER_STATUSES.REMOVED,
    cardStatus: 'removed',
    removedDate: new Date().toISOString(),
  };

  allSigners[accountId] = accountSigners;
  const saved = saveAllSigners(allSigners);

  if (!saved) {
    return {
      success: false,
      message: 'Failed to remove signer.',
    };
  }

  // Update account signer count
  const newActiveCount = countActiveSigners(accountSigners);
  updateAccountSignerCount(accountId, newActiveCount);

  logEvent(ACTION_TYPES.SIGNER_REMOVED, session.userId, {
    accountId: accountId,
    signerId: trimmedSignerId,
    signerName: signerName,
    message: `Signer ${signerName} removed from account.`,
  });

  return {
    success: true,
    message: `Signer ${signerName} has been removed.`,
  };
}

/**
 * Unlocks a locked signer with daily rate-limiting (max per day)
 * and attempt-based messaging.
 *
 * @param {string} signerId - The signer ID to unlock.
 * @returns {{ success: boolean, message: string, remainingAttempts: number|null }}
 *   Result object indicating success or failure with remaining attempts.
 */
export function unlockSigner(signerId) {
  const session = getSession();

  if (!session) {
    return {
      success: false,
      message: 'No active session. Please log in first.',
      remainingAttempts: null,
    };
  }

  if (!signerId || typeof signerId !== 'string') {
    return {
      success: false,
      message: 'Signer ID is required.',
      remainingAttempts: null,
    };
  }

  const trimmedSignerId = signerId.trim();
  const found = findSignerById(trimmedSignerId);

  if (!found) {
    return {
      success: false,
      message: 'Signer not found.',
      remainingAttempts: null,
    };
  }

  const { accountId, signer, index } = found;

  if (signer.status === SIGNER_STATUSES.REMOVED) {
    return {
      success: false,
      message: 'Cannot unlock a removed signer.',
      remainingAttempts: null,
    };
  }

  if (signer.status !== SIGNER_STATUSES.LOCKED && signer.cardStatus !== 'locked') {
    return {
      success: false,
      message: 'Signer is not locked.',
      remainingAttempts: null,
    };
  }

  // Check daily rate limit
  const rateLimits = getRateLimits();
  const today = getCalendarDayKey();

  // Reset if different day
  if (rateLimits.unlockLastDate && rateLimits.unlockLastDate !== today) {
    rateLimits.unlockAttempts = 0;
    rateLimits.unlockLastDate = null;
    saveRateLimits(rateLimits);
  }

  if (rateLimits.unlockAttempts >= UNLOCK_MAX_DAILY) {
    const attemptMessages = getUnlockAttemptMessage(rateLimits.unlockAttempts, UNLOCK_MAX_DAILY);

    logEvent(ACTION_TYPES.CARD_UNLOCK_FAILED, session.userId, {
      accountId: accountId,
      signerId: trimmedSignerId,
      reason: 'Maximum daily unlock attempts exceeded.',
    });

    return {
      success: false,
      message: attemptMessages.error,
      remainingAttempts: 0,
    };
  }

  // Increment unlock attempts
  rateLimits.unlockAttempts = (rateLimits.unlockAttempts || 0) + 1;
  rateLimits.unlockLastDate = today;
  saveRateLimits(rateLimits);

  const currentAttempt = rateLimits.unlockAttempts;
  const remaining = Math.max(0, UNLOCK_MAX_DAILY - currentAttempt);

  // Perform unlock
  const allSigners = getAllSigners();
  const accountSigners = allSigners[accountId];

  accountSigners[index] = {
    ...signer,
    status: SIGNER_STATUSES.ACTIVE,
    cardStatus: 'active',
    unlockAttempts: (signer.unlockAttempts || 0) + 1,
    lastUnlockedDate: new Date().toISOString(),
  };

  allSigners[accountId] = accountSigners;
  const saved = saveAllSigners(allSigners);

  if (!saved) {
    logEvent(ACTION_TYPES.CARD_UNLOCK_FAILED, session.userId, {
      accountId: accountId,
      signerId: trimmedSignerId,
      reason: 'Failed to save unlock state.',
    });

    return {
      success: false,
      message: 'Failed to unlock signer. Please try again.',
      remainingAttempts: remaining,
    };
  }

  const attemptMessages = getUnlockAttemptMessage(currentAttempt, UNLOCK_MAX_DAILY);

  logEvent(ACTION_TYPES.CARD_UNLOCKED, session.userId, {
    accountId: accountId,
    signerId: trimmedSignerId,
    signerName: `${signer.firstName} ${signer.lastName}`,
    attemptNumber: currentAttempt,
    remainingAttempts: remaining,
    message: `Signer ${signer.firstName} ${signer.lastName} unlocked.`,
  });

  let message = `Signer ${signer.firstName} ${signer.lastName} has been unlocked successfully.`;
  if (remaining < UNLOCK_MAX_DAILY) {
    message += ` ${attemptMessages.warning}`;
  }

  return {
    success: true,
    message: message,
    remainingAttempts: remaining,
  };
}

/**
 * Resends an invitation to a signer with daily rate-limiting (max per day)
 * and generates a new mock invitation token.
 *
 * @param {string} signerId - The signer ID to resend the invitation for.
 * @returns {{ success: boolean, message: string, remainingResends: number|null }}
 *   Result object indicating success or failure with remaining resends.
 */
export function resendInvitation(signerId) {
  const session = getSession();

  if (!session) {
    return {
      success: false,
      message: 'No active session. Please log in first.',
      remainingResends: null,
    };
  }

  if (!signerId || typeof signerId !== 'string') {
    return {
      success: false,
      message: 'Signer ID is required.',
      remainingResends: null,
    };
  }

  const trimmedSignerId = signerId.trim();
  const found = findSignerById(trimmedSignerId);

  if (!found) {
    return {
      success: false,
      message: 'Signer not found.',
      remainingResends: null,
    };
  }

  const { accountId, signer, index } = found;

  if (signer.status === SIGNER_STATUSES.REMOVED) {
    return {
      success: false,
      message: 'Cannot resend invitation to a removed signer.',
      remainingResends: null,
    };
  }

  // Check daily rate limit using signer-level tracking
  const today = getCalendarDayKey();
  let signerResendAttempts = signer.resendAttempts || 0;

  // Reset if different day
  if (signer.resendLastDate && signer.resendLastDate !== today) {
    signerResendAttempts = 0;
  }

  if (signerResendAttempts >= RESEND_MAX_DAILY) {
    const attemptMessages = getResendAttemptMessage(signerResendAttempts, RESEND_MAX_DAILY);

    logEvent(ACTION_TYPES.OTP_FAILED, session.userId, {
      accountId: accountId,
      signerId: trimmedSignerId,
      reason: 'Maximum daily resend attempts exceeded for signer.',
    });

    return {
      success: false,
      message: attemptMessages.error,
      remainingResends: 0,
    };
  }

  // Increment resend attempts
  signerResendAttempts += 1;
  const remaining = Math.max(0, RESEND_MAX_DAILY - signerResendAttempts);
  const attemptMessages = getResendAttemptMessage(signerResendAttempts, RESEND_MAX_DAILY);

  // Generate new invitation token
  const newToken = `invite-${generateReferenceId()}`;
  const now = new Date();

  const allSigners = getAllSigners();
  const accountSigners = allSigners[accountId];

  accountSigners[index] = {
    ...signer,
    invitationToken: newToken,
    lastInvitationSent: now.toISOString(),
    resendAttempts: signerResendAttempts,
    resendLastDate: today,
  };

  allSigners[accountId] = accountSigners;
  const saved = saveAllSigners(allSigners);

  if (!saved) {
    return {
      success: false,
      message: 'Failed to resend invitation. Please try again.',
      remainingResends: remaining,
    };
  }

  logEvent(ACTION_TYPES.OTP_RESENT, session.userId, {
    accountId: accountId,
    signerId: trimmedSignerId,
    signerName: `${signer.firstName} ${signer.lastName}`,
    resendAttempt: signerResendAttempts,
    remainingResends: remaining,
    message: `Invitation resent to signer ${signer.firstName} ${signer.lastName}.`,
  });

  return {
    success: true,
    message: attemptMessages.success,
    remainingResends: remaining,
  };
}

/**
 * Sorts an array of signers by a specified field and direction.
 *
 * @param {Array<Object>} signers - The array of signers to sort.
 * @param {string} [field='lastName'] - The field to sort by (e.g., 'firstName', 'lastName', 'status', 'role', 'addedDate').
 * @param {string} [direction='asc'] - The sort direction ('asc' or 'desc').
 * @returns {Array<Object>} A new sorted array of signers.
 */
export function sortSigners(signers, field = 'lastName', direction = 'asc') {
  if (!Array.isArray(signers)) {
    return [];
  }

  if (signers.length === 0) {
    return [];
  }

  const validFields = ['firstName', 'lastName', 'status', 'role', 'email', 'phone', 'addedDate', 'cardStatus'];
  const sortField = validFields.includes(field) ? field : 'lastName';
  const sortDirection = direction === 'desc' ? 'desc' : 'asc';

  const sorted = [...signers].sort((a, b) => {
    let valA = a[sortField] || '';
    let valB = b[sortField] || '';

    // Handle date fields
    if (sortField === 'addedDate') {
      const dateA = new Date(valA).getTime() || 0;
      const dateB = new Date(valB).getTime() || 0;
      return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
    }

    // String comparison (case-insensitive)
    if (typeof valA === 'string') {
      valA = valA.toLowerCase();
    }
    if (typeof valB === 'string') {
      valB = valB.toLowerCase();
    }

    if (valA < valB) {
      return sortDirection === 'asc' ? -1 : 1;
    }
    if (valA > valB) {
      return sortDirection === 'asc' ? 1 : -1;
    }
    return 0;
  });

  return sorted;
}

/**
 * Filters an array of signers based on the provided criteria.
 *
 * @param {Array<Object>} signers - The array of signers to filter.
 * @param {Object} [criteria={}] - The filter criteria.
 * @param {string} [criteria.status] - Filter by signer status.
 * @param {string} [criteria.role] - Filter by signer role.
 * @param {string} [criteria.search] - Search term to match against firstName, lastName, or email.
 * @param {string} [criteria.cardStatus] - Filter by card status.
 * @returns {Array<Object>} A new filtered array of signers.
 */
export function filterSigners(signers, criteria = {}) {
  if (!Array.isArray(signers)) {
    return [];
  }

  if (signers.length === 0) {
    return [];
  }

  if (!criteria || typeof criteria !== 'object') {
    return [...signers];
  }

  let filtered = [...signers];

  // Filter by status
  if (criteria.status && typeof criteria.status === 'string') {
    const statusFilter = criteria.status.trim().toLowerCase();
    filtered = filtered.filter(
      (s) => s.status && s.status.toLowerCase() === statusFilter
    );
  }

  // Filter by role
  if (criteria.role && typeof criteria.role === 'string') {
    const roleFilter = criteria.role.trim().toLowerCase();
    filtered = filtered.filter(
      (s) => s.role && s.role.toLowerCase() === roleFilter
    );
  }

  // Filter by card status
  if (criteria.cardStatus && typeof criteria.cardStatus === 'string') {
    const cardStatusFilter = criteria.cardStatus.trim().toLowerCase();
    filtered = filtered.filter(
      (s) => s.cardStatus && s.cardStatus.toLowerCase() === cardStatusFilter
    );
  }

  // Search by name or email
  if (criteria.search && typeof criteria.search === 'string') {
    const searchTerm = criteria.search.trim().toLowerCase();
    if (searchTerm.length > 0) {
      filtered = filtered.filter((s) => {
        const firstName = (s.firstName || '').toLowerCase();
        const lastName = (s.lastName || '').toLowerCase();
        const email = (s.email || '').toLowerCase();
        const fullName = `${firstName} ${lastName}`;

        return (
          firstName.includes(searchTerm) ||
          lastName.includes(searchTerm) ||
          email.includes(searchTerm) ||
          fullName.includes(searchTerm)
        );
      });
    }
  }

  return filtered;
}