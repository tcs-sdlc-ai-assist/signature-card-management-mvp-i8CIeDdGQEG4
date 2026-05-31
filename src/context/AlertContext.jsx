/**
 * AlertContext for SIG Card Management.
 * Provides global alert state and actions to all components via React context.
 * Integrates with AlertService for consistent alert management across the application.
 * Supports adding, dismissing, and clearing alerts with auto-dismiss and retry capabilities.
 */

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  showAlert as serviceShowAlert,
  dismissAlert as serviceDismissAlert,
  clearAlerts as serviceClearAlerts,
  getAlerts as serviceGetAlerts,
  subscribe as serviceSubscribe,
  showError,
  showWarning,
  showSuccess,
  showInfo,
  resetAlertService,
} from '../services/alertService.js';

/**
 * @typedef {Object} AlertContextValue
 * @property {Array<Object>} alerts - The current array of alert objects.
 * @property {Function} addAlert - Add a new alert.
 * @property {Function} removeAlert - Remove an alert by ID.
 * @property {Function} clearAllAlerts - Clear all alerts.
 * @property {Function} addError - Convenience method to add an error alert.
 * @property {Function} addWarning - Convenience method to add a warning alert.
 * @property {Function} addSuccess - Convenience method to add a success alert.
 * @property {Function} addInfo - Convenience method to add an info alert.
 */

const AlertContext = createContext(null);

/**
 * Custom hook to access the AlertContext.
 * Throws an error if used outside of AlertProvider.
 * @returns {AlertContextValue} The alert context value.
 */
export function useAlerts() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlerts must be used within an AlertProvider.');
  }
  return context;
}

/**
 * AlertProvider component.
 * Wraps the application to provide global alert state and actions to all child components.
 * Subscribes to AlertService for state synchronization.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components.
 * @returns {JSX.Element} The AlertProvider component.
 */
export function AlertProvider({ children }) {
  const [alerts, setAlerts] = useState(() => serviceGetAlerts());

  /**
   * Subscribe to AlertService changes on mount.
   * Updates local state whenever alerts are added, dismissed, or cleared.
   */
  useEffect(() => {
    const unsubscribe = serviceSubscribe((updatedAlerts) => {
      setAlerts(updatedAlerts);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  /**
   * Adds a new alert via AlertService.
   * @param {string} type - The alert type ('error', 'warning', 'success', 'info').
   * @param {string} message - The alert message to display.
   * @param {Object} [options={}] - Optional configuration for the alert.
   * @param {number|null} [options.autoDismissMs] - Auto-dismiss duration in milliseconds.
   * @param {boolean} [options.dismissible] - Whether the alert can be manually dismissed.
   * @param {Function|null} [options.onRetry] - Retry callback for transient errors.
   * @param {string} [options.title] - Optional title for the alert.
   * @param {string} [options.ariaLive] - ARIA live region attribute.
   * @returns {{ success: boolean, alertId: string|null }} Result with the created alert ID.
   */
  const addAlert = useCallback((type, message, options = {}) => {
    return serviceShowAlert(type, message, options);
  }, []);

  /**
   * Removes an alert by its ID via AlertService.
   * @param {string} alertId - The ID of the alert to dismiss.
   * @returns {{ success: boolean, message: string }} Result indicating whether the alert was dismissed.
   */
  const removeAlert = useCallback((alertId) => {
    return serviceDismissAlert(alertId);
  }, []);

  /**
   * Clears all alerts via AlertService.
   * @returns {{ success: boolean, message: string }} Result indicating whether all alerts were cleared.
   */
  const clearAllAlerts = useCallback(() => {
    return serviceClearAlerts();
  }, []);

  /**
   * Convenience method to add an error alert.
   * @param {string} message - The error message to display.
   * @param {Object} [options={}] - Optional configuration for the alert.
   * @returns {{ success: boolean, alertId: string|null }}
   */
  const addError = useCallback((message, options = {}) => {
    return showError(message, options);
  }, []);

  /**
   * Convenience method to add a warning alert.
   * @param {string} message - The warning message to display.
   * @param {Object} [options={}] - Optional configuration for the alert.
   * @returns {{ success: boolean, alertId: string|null }}
   */
  const addWarning = useCallback((message, options = {}) => {
    return showWarning(message, options);
  }, []);

  /**
   * Convenience method to add a success alert.
   * @param {string} message - The success message to display.
   * @param {Object} [options={}] - Optional configuration for the alert.
   * @returns {{ success: boolean, alertId: string|null }}
   */
  const addSuccess = useCallback((message, options = {}) => {
    return showSuccess(message, options);
  }, []);

  /**
   * Convenience method to add an info alert.
   * @param {string} message - The info message to display.
   * @param {Object} [options={}] - Optional configuration for the alert.
   * @returns {{ success: boolean, alertId: string|null }}
   */
  const addInfo = useCallback((message, options = {}) => {
    return showInfo(message, options);
  }, []);

  const value = useMemo(() => ({
    alerts,
    addAlert,
    removeAlert,
    clearAllAlerts,
    addError,
    addWarning,
    addSuccess,
    addInfo,
  }), [
    alerts,
    addAlert,
    removeAlert,
    clearAllAlerts,
    addError,
    addWarning,
    addSuccess,
    addInfo,
  ]);

  return (
    <AlertContext.Provider value={value}>
      {children}
    </AlertContext.Provider>
  );
}

AlertProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export default AlertContext;