/**
 * Application configuration constants.
 * Values are loaded from environment variables (import.meta.env) with sensible defaults.
 */

/** @type {number} Session timeout in milliseconds (default: 15 minutes) */
export const SESSION_TIMEOUT_MS =
  (parseInt(import.meta.env.VITE_SESSION_TIMEOUT_MINUTES, 10) || 15) * 60 * 1000;

/** @type {number} Session warning threshold in milliseconds (default: 13 minutes, i.e. warn 2 min before timeout) */
export const SESSION_WARNING_MS =
  ((parseInt(import.meta.env.VITE_SESSION_TIMEOUT_MINUTES, 10) || 15) -
    (parseInt(import.meta.env.VITE_SESSION_WARNING_MINUTES, 10) || 2)) *
  60 *
  1000;

/** @type {number} Maximum number of failed login attempts before lockout (default: 5) */
export const MAX_LOGIN_ATTEMPTS =
  parseInt(import.meta.env.VITE_MAX_LOGIN_ATTEMPTS, 10) || 5;

/** @type {number} OTP expiry time in milliseconds (default: 5 minutes / 300 seconds) */
export const OTP_EXPIRY_MS =
  (parseInt(import.meta.env.VITE_OTP_EXPIRY_SECONDS, 10) || 300) * 1000;

/** @type {number} Maximum number of OTP verification attempts (default: 3) */
export const OTP_MAX_ATTEMPTS =
  parseInt(import.meta.env.VITE_OTP_MAX_ATTEMPTS, 10) || 3;

/** @type {number} Cooldown period in milliseconds before OTP can be resent (default: 60 seconds) */
export const OTP_RESEND_COOLDOWN_MS =
  (parseInt(import.meta.env.VITE_OTP_RESEND_COOLDOWN_SECONDS, 10) || 60) * 1000;

/** @type {number} Maximum number of OTP resend requests allowed (default: 3) */
export const OTP_MAX_RESENDS =
  parseInt(import.meta.env.VITE_RESEND_MAX_DAILY, 10) || 3;

/** @type {number} Authentication token expiry in milliseconds (default: 72 hours) */
export const TOKEN_EXPIRY_MS =
  (parseInt(import.meta.env.VITE_TOKEN_EXPIRY_HOURS, 10) || 72) * 60 * 60 * 1000;

/** @type {number} Maximum number of card unlock requests allowed per day (default: 3) */
export const UNLOCK_MAX_DAILY =
  parseInt(import.meta.env.VITE_UNLOCK_MAX_DAILY, 10) || 3;

/** @type {number} Maximum number of OTP resend requests allowed per day (default: 3) */
export const RESEND_MAX_DAILY =
  parseInt(import.meta.env.VITE_RESEND_MAX_DAILY, 10) || 3;