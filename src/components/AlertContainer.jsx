/**
 * AlertContainer component for SIG Card Management.
 * Global alert container that renders all active alerts from AlertContext.
 * Uses HB CSS alert classes (hb-alert-critical, hb-alert-warning, hb-alert-success).
 * Supports dismiss, auto-dismiss timer, and retry button for transient errors.
 * Positioned at top of viewport. Accessible with role='alert' and aria-live.
 *
 * @module AlertContainer
 * @see AlertContext
 * @user-story SCRUM-8965
 */

import { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useAlerts } from '../context/AlertContext.jsx';
import { classNames } from '../utils/helpers.js';
import { ALERT_TYPES } from '../constants/constants.js';

/**
 * Returns the appropriate icon character for a given alert type.
 * @param {string} type - The alert type.
 * @returns {string} The icon character.
 */
function getAlertIcon(type) {
  switch (type) {
    case ALERT_TYPES.ERROR:
      return '✕';
    case ALERT_TYPES.WARNING:
      return '⚠';
    case ALERT_TYPES.SUCCESS:
      return '✓';
    case ALERT_TYPES.INFO:
      return 'ℹ';
    default:
      return 'ℹ';
  }
}

/**
 * Returns the appropriate label for a given alert type.
 * @param {string} type - The alert type.
 * @returns {string} The label string.
 */
function getAlertLabel(type) {
  switch (type) {
    case ALERT_TYPES.ERROR:
      return 'Error';
    case ALERT_TYPES.WARNING:
      return 'Warning';
    case ALERT_TYPES.SUCCESS:
      return 'Success';
    case ALERT_TYPES.INFO:
      return 'Information';
    default:
      return 'Information';
  }
}

/**
 * Returns inline styles for the alert based on its type.
 * @param {string} type - The alert type.
 * @returns {Object} The style object.
 */
function getAlertStyles(type) {
  switch (type) {
    case ALERT_TYPES.ERROR:
      return {
        backgroundColor: '#fce8e6',
        borderLeft: '4px solid #d93025',
        color: '#5f2120',
      };
    case ALERT_TYPES.WARNING:
      return {
        backgroundColor: '#fef7e0',
        borderLeft: '4px solid #f9ab00',
        color: '#663c00',
      };
    case ALERT_TYPES.SUCCESS:
      return {
        backgroundColor: '#e6f4ea',
        borderLeft: '4px solid #34a853',
        color: '#1e4620',
      };
    case ALERT_TYPES.INFO:
      return {
        backgroundColor: '#e8f0fe',
        borderLeft: '4px solid #1a73e8',
        color: '#174ea6',
      };
    default:
      return {
        backgroundColor: '#e8f0fe',
        borderLeft: '4px solid #1a73e8',
        color: '#174ea6',
      };
  }
}

/**
 * Single alert item component.
 * Renders an individual alert with dismiss button and optional retry action.
 *
 * @param {Object} props - Component props.
 * @param {Object} props.alert - The alert object.
 * @param {Function} props.onDismiss - Callback to dismiss the alert.
 * @returns {JSX.Element} The AlertItem component.
 */
function AlertItem({ alert, onDismiss }) {
  const typeStyles = getAlertStyles(alert.type);
  const icon = getAlertIcon(alert.type);
  const label = getAlertLabel(alert.type);

  /**
   * Handles the dismiss button click.
   * @returns {void}
   */
  const handleDismiss = useCallback(() => {
    onDismiss(alert.id);
  }, [alert.id, onDismiss]);

  /**
   * Handles the retry button click.
   * @returns {void}
   */
  const handleRetry = useCallback(() => {
    if (typeof alert.onRetry === 'function') {
      alert.onRetry();
    }
  }, [alert]);

  /**
   * Handles keyboard interaction on the dismiss button.
   * @param {React.KeyboardEvent} event - The keyboard event.
   * @returns {void}
   */
  const handleDismissKeyDown = useCallback((event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onDismiss(alert.id);
    }
  }, [alert.id, onDismiss]);

  return (
    <div
      className={classNames('alert-container__item', alert.cssClass)}
      role="alert"
      aria-live={alert.ariaLive || 'polite'}
      aria-atomic="true"
      style={{
        ...typeStyles,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        padding: '0.75rem 1rem',
        borderRadius: '4px',
        marginBottom: '0.5rem',
        fontSize: '0.9375rem',
        lineHeight: 1.5,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        position: 'relative',
      }}
    >
      {/* Icon and content */}
      <div
        className="alert-container__item-content"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.625rem',
          flex: '1 1 auto',
          minWidth: 0,
        }}
      >
        <span
          className="alert-container__item-icon"
          aria-hidden="true"
          style={{
            fontSize: '1.125rem',
            lineHeight: 1.4,
            flexShrink: 0,
            fontWeight: 700,
          }}
        >
          {icon}
        </span>
        <div
          className="alert-container__item-body"
          style={{
            flex: '1 1 auto',
            minWidth: 0,
          }}
        >
          {alert.title && (
            <strong
              className="alert-container__item-title"
              style={{
                display: 'block',
                fontSize: '0.9375rem',
                fontWeight: 600,
                marginBottom: '0.125rem',
              }}
            >
              {alert.title}
            </strong>
          )}
          <span className="alert-container__item-message">
            {alert.message}
          </span>
          {/* Retry button for transient errors */}
          {typeof alert.onRetry === 'function' && (
            <button
              type="button"
              className="hb-btn alert-container__retry-btn"
              onClick={handleRetry}
              aria-label={`Retry: ${label}`}
              style={{
                display: 'inline-block',
                marginLeft: '0.5rem',
                padding: '0.125rem 0.5rem',
                fontSize: '0.8125rem',
                fontWeight: 500,
                borderRadius: '3px',
                border: '1px solid currentColor',
                backgroundColor: 'transparent',
                color: 'inherit',
                cursor: 'pointer',
                lineHeight: 1.5,
                verticalAlign: 'middle',
              }}
            >
              Retry
            </button>
          )}
        </div>
      </div>

      {/* Dismiss button */}
      {alert.dismissible && (
        <button
          type="button"
          className="alert-container__dismiss-btn"
          onClick={handleDismiss}
          onKeyDown={handleDismissKeyDown}
          aria-label={`Dismiss ${label.toLowerCase()} alert`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '1.5rem',
            height: '1.5rem',
            padding: 0,
            border: 'none',
            backgroundColor: 'transparent',
            color: 'inherit',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 700,
            lineHeight: 1,
            opacity: 0.7,
            flexShrink: 0,
            marginLeft: '0.5rem',
            borderRadius: '3px',
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

AlertItem.propTypes = {
  alert: PropTypes.shape({
    id: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
    message: PropTypes.string.isRequired,
    title: PropTypes.string,
    cssClass: PropTypes.string,
    dismissible: PropTypes.bool,
    onRetry: PropTypes.func,
    ariaLive: PropTypes.string,
    createdAt: PropTypes.string,
  }).isRequired,
  onDismiss: PropTypes.func.isRequired,
};

/**
 * AlertContainer component.
 * Renders all active alerts from AlertContext at the top of the viewport.
 * Each alert supports dismiss, auto-dismiss (handled by AlertService),
 * and retry for transient errors.
 *
 * @param {Object} [props] - Component props.
 * @param {string} [props.className] - Additional CSS class names to apply to the container.
 * @returns {JSX.Element|null} The AlertContainer component, or null if no alerts.
 */
export function AlertContainer({ className }) {
  const { alerts, removeAlert } = useAlerts();

  /**
   * Handles dismissing an alert by its ID.
   * @param {string} alertId - The ID of the alert to dismiss.
   * @returns {void}
   */
  const handleDismiss = useCallback((alertId) => {
    removeAlert(alertId);
  }, [removeAlert]);

  /**
   * Memoized list of alert items to render.
   * @type {Array<Object>}
   */
  const alertItems = useMemo(() => {
    if (!Array.isArray(alerts)) {
      return [];
    }
    return alerts;
  }, [alerts]);

  if (alertItems.length === 0) {
    return null;
  }

  const containerClassName = classNames('alert-container', className);

  return (
    <div
      className={containerClassName}
      aria-label="Notifications"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9998,
        padding: '0.75rem 1.5rem',
        maxWidth: '720px',
        margin: '0 auto',
        pointerEvents: 'none',
      }}
    >
      <div
        className="alert-container__list"
        style={{
          pointerEvents: 'auto',
        }}
      >
        {alertItems.map((alert) => (
          <AlertItem
            key={alert.id}
            alert={alert}
            onDismiss={handleDismiss}
          />
        ))}
      </div>
    </div>
  );
}

AlertContainer.propTypes = {
  className: PropTypes.string,
};

AlertContainer.defaultProps = {
  className: '',
};

export default AlertContainer;