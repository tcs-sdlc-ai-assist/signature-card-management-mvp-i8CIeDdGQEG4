/**
 * AlertService for SIG Card Management.
 * Provides alert notification management using HB CSS alert classes
 * (hb-alert-critical, hb-alert-warning, hb-alert-success).
 * Manages an alert queue, auto-dismiss timers, and retry callbacks for transient errors.
 * All state is held in-memory with optional subscriber notification.
 */

import { generateReferenceId } from '../utils/helpers.js';
import { ALERT_TYPES } from '../constants/constants.js';

/**
 * Maps alert types to HB CSS framework alert classes.
 * @type {Object<string, string>}
 */
const ALERT_CSS_CLASSES = Object.freeze({
  [ALERT_TYPES.ERROR]: 'hb-alert-critical',
  [ALERT_TYPES.WARNING]: 'hb-alert-warning',
  [ALERT_TYPES.SUCCESS]: 'hb-alert-success',
  [ALERT_TYPES.INFO]: 'hb-alert-info',
});

/** @type {number} Default auto-dismiss duration in milliseconds for success alerts */
const DEFAULT_SUCCESS_DISMISS_MS = 5000;

/** @type {number} Default auto-dismiss duration in milliseconds for info alerts */
const DEFAULT_INFO_DISMISS_MS = 5000;

/** @type {number} Default auto-dismiss duration in milliseconds for warning alerts */
const DEFAULT_WARNING_DISMISS_MS = 8000;

/** @type {number} Maximum number of alerts in the queue */
const MAX_ALERT_QUEUE_SIZE = 10;

/**
 * Internal alert queue.
 * @type {Array<Object>}
 */
let alertQueue = [];

/**
 * Map of active auto-dismiss timer IDs keyed by alert ID.
 * @type {Object<string, number>}
 */
const dismissTimers = {};

/**
 * List of subscriber callbacks to notify on alert state changes.
 * @type {Array<Function>}
 */
let subscribers = [];

/**
 * Notifies all subscribers of the current alert queue state.
 * @returns {void}
 */
function notifySubscribers() {
  const currentAlerts = getAlerts();
  for (let i = 0; i < subscribers.length; i++) {
    try {
      subscribers[i](currentAlerts);
    } catch (_e) {
      // Silently ignore subscriber errors
    }
  }
}

/**
 * Returns the HB CSS class for a given alert type.
 * @param {string} type - The alert type (error, warning, success, info).
 * @returns {string} The corresponding HB CSS class.
 */
function getAlertCssClass(type) {
  if (!type || typeof type !== 'string') {
    return ALERT_CSS_CLASSES[ALERT_TYPES.INFO];
  }

  const normalizedType = type.trim().toLowerCase();
  return ALERT_CSS_CLASSES[normalizedType] || ALERT_CSS_CLASSES[ALERT_TYPES.INFO];
}

/**
 * Returns the default auto-dismiss duration for a given alert type.
 * Error alerts do not auto-dismiss by default.
 * @param {string} type - The alert type.
 * @returns {number|null} The auto-dismiss duration in milliseconds, or null for no auto-dismiss.
 */
function getDefaultDismissDuration(type) {
  if (!type || typeof type !== 'string') {
    return DEFAULT_INFO_DISMISS_MS;
  }

  const normalizedType = type.trim().toLowerCase();

  switch (normalizedType) {
    case ALERT_TYPES.SUCCESS:
      return DEFAULT_SUCCESS_DISMISS_MS;
    case ALERT_TYPES.INFO:
      return DEFAULT_INFO_DISMISS_MS;
    case ALERT_TYPES.WARNING:
      return DEFAULT_WARNING_DISMISS_MS;
    case ALERT_TYPES.ERROR:
      return null;
    default:
      return DEFAULT_INFO_DISMISS_MS;
  }
}

/**
 * Creates and displays an alert notification.
 * Adds the alert to the queue, sets up auto-dismiss if applicable,
 * and notifies all subscribers.
 *
 * @param {string} type - The alert type ('error', 'warning', 'success', 'info').
 * @param {string} message - The alert message to display.
 * @param {Object} [options={}] - Optional configuration for the alert.
 * @param {number|null} [options.autoDismissMs] - Auto-dismiss duration in milliseconds. Pass null to disable. Defaults based on type.
 * @param {boolean} [options.dismissible=true] - Whether the alert can be manually dismissed.
 * @param {Function|null} [options.onRetry] - Retry callback for transient errors. Displayed as a retry action.
 * @param {string} [options.title] - Optional title for the alert.
 * @param {string} [options.ariaLive] - ARIA live region attribute ('polite' or 'assertive'). Defaults based on type.
 * @returns {{ success: boolean, alertId: string|null }} Result with the created alert ID.
 */
export function showAlert(type, message, options = {}) {
  if (!message || typeof message !== 'string' || !message.trim()) {
    console.warn('AlertService: message is required and must be a non-empty string.');
    return { success: false, alertId: null };
  }

  const normalizedType = (type && typeof type === 'string')
    ? type.trim().toLowerCase()
    : ALERT_TYPES.INFO;

  const validTypes = [ALERT_TYPES.ERROR, ALERT_TYPES.WARNING, ALERT_TYPES.SUCCESS, ALERT_TYPES.INFO];
  const resolvedType = validTypes.includes(normalizedType) ? normalizedType : ALERT_TYPES.INFO;

  const alertId = `alert-${generateReferenceId()}`;
  const cssClass = getAlertCssClass(resolvedType);

  const dismissible = options.dismissible !== undefined ? Boolean(options.dismissible) : true;
  const onRetry = typeof options.onRetry === 'function' ? options.onRetry : null;
  const title = options.title && typeof options.title === 'string' ? options.title.trim() : null;

  let ariaLive = 'polite';
  if (options.ariaLive && typeof options.ariaLive === 'string') {
    ariaLive = options.ariaLive.trim().toLowerCase() === 'assertive' ? 'assertive' : 'polite';
  } else if (resolvedType === ALERT_TYPES.ERROR) {
    ariaLive = 'assertive';
  }

  const alert = {
    id: alertId,
    type: resolvedType,
    message: message.trim(),
    title: title,
    cssClass: cssClass,
    dismissible: dismissible,
    onRetry: onRetry,
    ariaLive: ariaLive,
    createdAt: new Date().toISOString(),
  };

  // Enforce max queue size by removing oldest alerts
  if (alertQueue.length >= MAX_ALERT_QUEUE_SIZE) {
    const removed = alertQueue.shift();
    if (removed && dismissTimers[removed.id]) {
      clearTimeout(dismissTimers[removed.id]);
      delete dismissTimers[removed.id];
    }
  }

  alertQueue.push(alert);

  // Set up auto-dismiss timer
  const autoDismissMs = options.autoDismissMs !== undefined
    ? options.autoDismissMs
    : getDefaultDismissDuration(resolvedType);

  if (autoDismissMs !== null && typeof autoDismissMs === 'number' && autoDismissMs > 0) {
    dismissTimers[alertId] = setTimeout(() => {
      dismissAlert(alertId);
    }, autoDismissMs);
  }

  notifySubscribers();

  return { success: true, alertId: alertId };
}

/**
 * Dismisses an alert by its ID.
 * Removes the alert from the queue, clears any auto-dismiss timer,
 * and notifies all subscribers.
 *
 * @param {string} alertId - The ID of the alert to dismiss.
 * @returns {{ success: boolean, message: string }}
 *   Result indicating whether the alert was dismissed.
 */
export function dismissAlert(alertId) {
  if (!alertId || typeof alertId !== 'string') {
    return {
      success: false,
      message: 'Alert ID is required.',
    };
  }

  const trimmedId = alertId.trim();

  // Clear auto-dismiss timer if present
  if (dismissTimers[trimmedId]) {
    clearTimeout(dismissTimers[trimmedId]);
    delete dismissTimers[trimmedId];
  }

  const index = alertQueue.findIndex((alert) => alert.id === trimmedId);

  if (index === -1) {
    return {
      success: false,
      message: 'Alert not found.',
    };
  }

  alertQueue.splice(index, 1);

  notifySubscribers();

  return {
    success: true,
    message: 'Alert dismissed.',
  };
}

/**
 * Retrieves all current alerts in the queue.
 * Returns a shallow copy of each alert to prevent external mutation.
 *
 * @returns {Array<Object>} An array of alert objects, ordered by creation time (oldest first).
 */
export function getAlerts() {
  return alertQueue.map((alert) => ({
    id: alert.id,
    type: alert.type,
    message: alert.message,
    title: alert.title,
    cssClass: alert.cssClass,
    dismissible: alert.dismissible,
    onRetry: alert.onRetry,
    ariaLive: alert.ariaLive,
    createdAt: alert.createdAt,
  }));
}

/**
 * Clears all alerts from the queue and cancels all auto-dismiss timers.
 * Notifies all subscribers of the empty state.
 *
 * @returns {{ success: boolean, message: string }}
 *   Result indicating whether all alerts were cleared.
 */
export function clearAlerts() {
  const timerKeys = Object.keys(dismissTimers);
  for (let i = 0; i < timerKeys.length; i++) {
    clearTimeout(dismissTimers[timerKeys[i]]);
    delete dismissTimers[timerKeys[i]];
  }

  alertQueue = [];

  notifySubscribers();

  return {
    success: true,
    message: 'All alerts cleared.',
  };
}

/**
 * Subscribes a callback function to alert state changes.
 * The callback is invoked with the current array of alerts whenever
 * an alert is added, dismissed, or cleared.
 *
 * @param {Function} callback - The subscriber callback function.
 * @returns {Function} An unsubscribe function to remove the subscriber.
 */
export function subscribe(callback) {
  if (typeof callback !== 'function') {
    console.warn('AlertService: subscribe requires a function callback.');
    return function noop() {};
  }

  subscribers.push(callback);

  return function unsubscribe() {
    const idx = subscribers.indexOf(callback);
    if (idx !== -1) {
      subscribers.splice(idx, 1);
    }
  };
}

/**
 * Convenience method to show an error alert.
 *
 * @param {string} message - The error message to display.
 * @param {Object} [options={}] - Optional configuration for the alert.
 * @returns {{ success: boolean, alertId: string|null }}
 */
export function showError(message, options = {}) {
  return showAlert(ALERT_TYPES.ERROR, message, options);
}

/**
 * Convenience method to show a warning alert.
 *
 * @param {string} message - The warning message to display.
 * @param {Object} [options={}] - Optional configuration for the alert.
 * @returns {{ success: boolean, alertId: string|null }}
 */
export function showWarning(message, options = {}) {
  return showAlert(ALERT_TYPES.WARNING, message, options);
}

/**
 * Convenience method to show a success alert.
 *
 * @param {string} message - The success message to display.
 * @param {Object} [options={}] - Optional configuration for the alert.
 * @returns {{ success: boolean, alertId: string|null }}
 */
export function showSuccess(message, options = {}) {
  return showAlert(ALERT_TYPES.SUCCESS, message, options);
}

/**
 * Convenience method to show an info alert.
 *
 * @param {string} message - The info message to display.
 * @param {Object} [options={}] - Optional configuration for the alert.
 * @returns {{ success: boolean, alertId: string|null }}
 */
export function showInfo(message, options = {}) {
  return showAlert(ALERT_TYPES.INFO, message, options);
}

/**
 * Resets the alert service state.
 * Clears all alerts, timers, and subscribers.
 * Primarily used for testing and application reset scenarios.
 *
 * @returns {void}
 */
export function resetAlertService() {
  const timerKeys = Object.keys(dismissTimers);
  for (let i = 0; i < timerKeys.length; i++) {
    clearTimeout(dismissTimers[timerKeys[i]]);
    delete dismissTimers[timerKeys[i]];
  }

  alertQueue = [];
  subscribers = [];
}