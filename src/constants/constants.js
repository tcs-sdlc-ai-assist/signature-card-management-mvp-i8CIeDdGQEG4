/**
 * Application-wide constants for SIG Card Management.
 */

/**
 * Workflow steps in order of progression.
 * @type {string[]}
 */
export const WORKFLOW_STEPS = [
  'Welcome',
  'Login',
  'Verify Identity',
  'Select Account',
  'Manage Signers',
  'Add/Edit Signer',
  'Confirm Signers',
  'Review',
  'Submit',
];

/**
 * Workflow step indices for programmatic navigation.
 * @type {Object<string, number>}
 */
export const STEP_INDEX = Object.freeze(
  WORKFLOW_STEPS.reduce((acc, step, index) => {
    const key = step.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
    acc[key] = index;
    return acc;
  }, {})
);

/**
 * Signer status values.
 * @type {Object<string, string>}
 */
export const SIGNER_STATUSES = Object.freeze({
  ACTIVE: 'active',
  PENDING: 'pending',
  LOCKED: 'locked',
  REMOVED: 'removed',
});

/**
 * Alert type values used for notification banners.
 * @type {Object<string, string>}
 */
export const ALERT_TYPES = Object.freeze({
  ERROR: 'error',
  WARNING: 'warning',
  SUCCESS: 'success',
  INFO: 'info',
});

/**
 * Action types for audit logging.
 * @type {Object<string, string>}
 */
export const ACTION_TYPES = Object.freeze({
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  LOGIN_FAILED: 'LOGIN_FAILED',
  OTP_REQUESTED: 'OTP_REQUESTED',
  OTP_VERIFIED: 'OTP_VERIFIED',
  OTP_FAILED: 'OTP_FAILED',
  OTP_RESENT: 'OTP_RESENT',
  ACCOUNT_SELECTED: 'ACCOUNT_SELECTED',
  SIGNER_ADDED: 'SIGNER_ADDED',
  SIGNER_EDITED: 'SIGNER_EDITED',
  SIGNER_REMOVED: 'SIGNER_REMOVED',
  SIGNERS_CONFIRMED: 'SIGNERS_CONFIRMED',
  CARD_UNLOCKED: 'CARD_UNLOCKED',
  CARD_UNLOCK_FAILED: 'CARD_UNLOCK_FAILED',
  SUBMISSION_COMPLETED: 'SUBMISSION_COMPLETED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  SESSION_EXTENDED: 'SESSION_EXTENDED',
});

/**
 * Delivery methods for OTP and notifications.
 * @type {Object<string, string>}
 */
export const DELIVERY_METHODS = Object.freeze({
  SMS: 'sms',
  EMAIL: 'email',
});

/**
 * Messaging matrix for card unlock attempts.
 * Maps attempt number to user-facing messages.
 * @type {Object<number, { warning: string, error: string }>}
 */
export const UNLOCK_ATTEMPT_MESSAGES = Object.freeze({
  1: {
    warning: 'You have 2 unlock attempts remaining today.',
    error: 'Card unlock failed. Please try again.',
  },
  2: {
    warning: 'You have 1 unlock attempt remaining today.',
    error: 'Card unlock failed. You have 1 attempt remaining.',
  },
  3: {
    warning: 'This is your last unlock attempt for today.',
    error: 'Card unlock failed. You have reached the maximum number of unlock attempts for today. Please try again tomorrow.',
  },
});

/**
 * Messaging matrix for OTP resend attempts.
 * Maps attempt number to user-facing messages.
 * @type {Object<number, { warning: string, error: string, success: string }>}
 */
export const RESEND_ATTEMPT_MESSAGES = Object.freeze({
  1: {
    warning: 'You have 4 resend attempts remaining today.',
    error: 'Failed to resend OTP. Please try again.',
    success: 'A new OTP has been sent successfully.',
  },
  2: {
    warning: 'You have 3 resend attempts remaining today.',
    error: 'Failed to resend OTP. Please try again.',
    success: 'A new OTP has been sent successfully.',
  },
  3: {
    warning: 'You have 2 resend attempts remaining today.',
    error: 'Failed to resend OTP. Please try again.',
    success: 'A new OTP has been sent successfully.',
  },
  4: {
    warning: 'You have 1 resend attempt remaining today.',
    error: 'Failed to resend OTP. You have 1 attempt remaining.',
    success: 'A new OTP has been sent successfully.',
  },
  5: {
    warning: 'This is your last resend attempt for today.',
    error: 'Failed to resend OTP. You have reached the maximum number of resend attempts for today. Please try again tomorrow.',
    success: 'A new OTP has been sent. No further resends are available today.',
  },
});

/**
 * Returns the unlock attempt message for a given attempt number.
 * @param {number} attempt - The current attempt number (1-based).
 * @param {number} maxAttempts - The maximum allowed attempts.
 * @returns {{ warning: string, error: string }}
 */
export function getUnlockAttemptMessage(attempt, maxAttempts) {
  if (UNLOCK_ATTEMPT_MESSAGES[attempt]) {
    return UNLOCK_ATTEMPT_MESSAGES[attempt];
  }
  if (attempt >= maxAttempts) {
    return {
      warning: 'This is your last unlock attempt for today.',
      error: 'You have reached the maximum number of unlock attempts for today. Please try again tomorrow.',
    };
  }
  const remaining = maxAttempts - attempt;
  return {
    warning: `You have ${remaining} unlock attempt${remaining !== 1 ? 's' : ''} remaining today.`,
    error: 'Card unlock failed. Please try again.',
  };
}

/**
 * Returns the resend attempt message for a given attempt number.
 * @param {number} attempt - The current attempt number (1-based).
 * @param {number} maxAttempts - The maximum allowed attempts.
 * @returns {{ warning: string, error: string, success: string }}
 */
export function getResendAttemptMessage(attempt, maxAttempts) {
  if (RESEND_ATTEMPT_MESSAGES[attempt]) {
    return RESEND_ATTEMPT_MESSAGES[attempt];
  }
  if (attempt >= maxAttempts) {
    return {
      warning: 'This is your last resend attempt for today.',
      error: 'You have reached the maximum number of resend attempts for today. Please try again tomorrow.',
      success: 'A new OTP has been sent. No further resends are available today.',
    };
  }
  const remaining = maxAttempts - attempt;
  return {
    warning: `You have ${remaining} resend attempt${remaining !== 1 ? 's' : ''} remaining today.`,
    error: 'Failed to resend OTP. Please try again.',
    success: 'A new OTP has been sent successfully.',
  };
}