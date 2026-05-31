/**
 * SessionTimeoutModal component for SIG Card Management.
 * Session timeout warning modal displayed when the session enters the warning period
 * (at 13 minutes of inactivity by default). Shows a countdown timer to session expiry.
 * Provides 'Continue Session' button (refreshes activity) and 'Log Out' button.
 * Uses the Modal component. Consumes AuthContext for session state.
 * Auto-redirects to login on expiry with 'Session expired' message.
 *
 * @module SessionTimeoutModal
 * @see AuthContext
 * @see Modal
 * @user-story SCRUM-8955
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from '../context/AuthContext.jsx';
import { Modal } from './Modal.jsx';
import { SESSION_TIMEOUT_MS, SESSION_WARNING_MS } from '../config.js';
import { classNames } from '../utils/helpers.js';

/**
 * Calculates the remaining seconds until session timeout based on the session's lastActivity.
 * @param {Object|null} session - The current session object.
 * @returns {number} The remaining seconds until timeout, or 0 if expired/invalid.
 */
function calculateRemainingSeconds(session) {
  if (!session || !session.lastActivity) {
    return 0;
  }

  const lastActivity = new Date(session.lastActivity).getTime();
  if (isNaN(lastActivity)) {
    return 0;
  }

  const elapsed = Date.now() - lastActivity;
  const remaining = SESSION_TIMEOUT_MS - elapsed;

  if (remaining <= 0) {
    return 0;
  }

  return Math.ceil(remaining / 1000);
}

/**
 * Formats seconds into a MM:SS display string.
 * @param {number} totalSeconds - The total seconds to format.
 * @returns {string} The formatted time string (e.g., "01:45").
 */
function formatCountdown(totalSeconds) {
  if (totalSeconds <= 0) {
    return '00:00';
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  return `${mm}:${ss}`;
}

/**
 * SessionTimeoutModal component.
 * Renders a modal dialog warning the user that their session is about to expire.
 * Displays a live countdown timer and provides options to extend or end the session.
 *
 * @param {Object} [props] - Component props.
 * @param {string} [props.className] - Additional CSS class names to apply to the modal.
 * @returns {JSX.Element|null} The SessionTimeoutModal component, or null if not showing.
 */
export function SessionTimeoutModal({ className }) {
  const {
    session,
    showSessionWarning,
    isAuthenticated,
    extendCurrentSession,
    logout,
    dismissSessionWarning,
  } = useAuth();

  const [remainingSeconds, setRemainingSeconds] = useState(() => {
    return calculateRemainingSeconds(session);
  });

  const countdownIntervalRef = useRef(null);

  /**
   * Updates the countdown timer every second while the warning is visible.
   */
  useEffect(() => {
    if (showSessionWarning && isAuthenticated) {
      // Set initial remaining seconds
      setRemainingSeconds(calculateRemainingSeconds(session));

      countdownIntervalRef.current = setInterval(() => {
        const remaining = calculateRemainingSeconds(session);
        setRemainingSeconds(remaining);

        if (remaining <= 0) {
          // Session has expired — trigger logout
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
          logout();
        }
      }, 1000);

      return () => {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
      };
    } else {
      // Clear interval when warning is dismissed
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    }
  }, [showSessionWarning, isAuthenticated, session, logout]);

  /**
   * Handles the 'Continue Session' button click.
   * Extends the session and dismisses the warning modal.
   * @returns {void}
   */
  const handleContinueSession = useCallback(() => {
    const extended = extendCurrentSession();
    if (extended) {
      dismissSessionWarning();
    }
  }, [extendCurrentSession, dismissSessionWarning]);

  /**
   * Handles the 'Log Out' button click.
   * Logs the user out immediately.
   * @returns {void}
   */
  const handleLogout = useCallback(() => {
    logout();
  }, [logout]);

  /**
   * Handles the modal close action.
   * Extends the session (same as continuing).
   * @returns {void}
   */
  const handleClose = useCallback(() => {
    handleContinueSession();
  }, [handleContinueSession]);

  /**
   * The formatted countdown display string.
   * @type {string}
   */
  const countdownDisplay = useMemo(() => {
    return formatCountdown(remainingSeconds);
  }, [remainingSeconds]);

  /**
   * Whether the countdown is critically low (under 60 seconds).
   * @type {boolean}
   */
  const isCritical = useMemo(() => {
    return remainingSeconds <= 60;
  }, [remainingSeconds]);

  if (!showSessionWarning || !isAuthenticated) {
    return null;
  }

  return (
    <Modal
      isOpen={showSessionWarning}
      onClose={handleClose}
      title="Session Timeout Warning"
      primaryButtonText="Continue Session"
      onPrimaryAction={handleContinueSession}
      secondaryButtonText="Log Out"
      onSecondaryAction={handleLogout}
      primaryButtonVariant="primary"
      showCloseButton={false}
      closeOnOverlayClick={false}
      closeOnEscape={false}
      className={classNames('session-timeout-modal', className)}
      size="small"
    >
      <div
        className="session-timeout-modal__content"
        style={{
          textAlign: 'center',
        }}
      >
        <p
          className="session-timeout-modal__message"
          style={{
            fontSize: '0.9375rem',
            lineHeight: 1.5,
            color: '#555555',
            marginBottom: '1rem',
          }}
        >
          Your session is about to expire due to inactivity. You will be logged out automatically when the timer reaches zero.
        </p>
        <div
          className="session-timeout-modal__timer"
          role="timer"
          aria-live="polite"
          aria-atomic="true"
          aria-label={`Session expires in ${remainingSeconds} seconds`}
          style={{
            fontSize: '2.5rem',
            fontWeight: 700,
            color: isCritical ? '#d93025' : '#1a73e8',
            padding: '1rem 0',
            fontFamily: 'monospace',
            letterSpacing: '0.1em',
          }}
        >
          {countdownDisplay}
        </div>
        <p
          className="session-timeout-modal__instruction"
          style={{
            fontSize: '0.875rem',
            lineHeight: 1.5,
            color: '#757575',
            marginTop: '0.5rem',
          }}
        >
          Click &quot;Continue Session&quot; to stay logged in.
        </p>
      </div>
    </Modal>
  );
}

SessionTimeoutModal.propTypes = {
  className: PropTypes.string,
};

SessionTimeoutModal.defaultProps = {
  className: '',
};

export default SessionTimeoutModal;