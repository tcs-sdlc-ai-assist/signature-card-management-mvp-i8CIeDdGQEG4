/**
 * NavigationBar component for SIG Card Management.
 * Top navigation bar with application title/logo, current user display,
 * logout button, and Cancel/Exit button with unsaved changes confirmation.
 * Uses HB CSS classes for styling. Consumes AuthContext for user info
 * and WorkflowContext for cancel functionality.
 *
 * @module NavigationBar
 * @see AuthContext
 * @see WorkflowContext
 * @user-story SCRUM-8964
 */

import { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from '../context/AuthContext.jsx';
import { useWorkflow } from '../context/WorkflowContext.jsx';
import { classNames } from '../utils/helpers.js';
import { STEP_INDEX } from '../constants/constants.js';

/**
 * NavigationBar component.
 * Renders a top navigation bar with:
 * - Application title/logo
 * - Current user display (name and role)
 * - Cancel/Exit button that triggers unsaved changes confirmation modal
 * - Logout button
 *
 * @param {Object} [props] - Component props.
 * @param {string} [props.className] - Additional CSS class names to apply to the nav container.
 * @returns {JSX.Element} The NavigationBar component.
 */
export function NavigationBar({ className }) {
  const { currentUser, isAuthenticated, logout } = useAuth();
  const { currentStep, stagedChanges, cancelWorkflow } = useWorkflow();

  const [showConfirmModal, setShowConfirmModal] = useState(false);

  /**
   * Whether there are unsaved/staged changes that would be lost on cancel.
   * @type {boolean}
   */
  const hasUnsavedChanges = useMemo(() => {
    return Array.isArray(stagedChanges) && stagedChanges.length > 0;
  }, [stagedChanges]);

  /**
   * Whether the cancel button should be visible.
   * Only show when authenticated and past the Welcome step.
   * @type {boolean}
   */
  const showCancelButton = useMemo(() => {
    return isAuthenticated && currentStep > STEP_INDEX.WELCOME && currentStep < STEP_INDEX.SUBMIT;
  }, [isAuthenticated, currentStep]);

  /**
   * Handles the Cancel/Exit button click.
   * If there are unsaved changes, shows a confirmation modal.
   * Otherwise, cancels the workflow directly.
   * @returns {void}
   */
  const handleCancelClick = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowConfirmModal(true);
    } else {
      cancelWorkflow();
    }
  }, [hasUnsavedChanges, cancelWorkflow]);

  /**
   * Confirms the cancel action from the modal.
   * Cancels the workflow and closes the modal.
   * @returns {void}
   */
  const handleConfirmCancel = useCallback(() => {
    setShowConfirmModal(false);
    cancelWorkflow();
  }, [cancelWorkflow]);

  /**
   * Dismisses the confirmation modal without canceling.
   * @returns {void}
   */
  const handleDismissModal = useCallback(() => {
    setShowConfirmModal(false);
  }, []);

  /**
   * Handles the Logout button click.
   * @returns {void}
   */
  const handleLogout = useCallback(() => {
    logout();
  }, [logout]);

  /**
   * Handles keyboard interaction on the modal overlay.
   * Closes the modal on Escape key press.
   * @param {React.KeyboardEvent} event - The keyboard event.
   * @returns {void}
   */
  const handleModalKeyDown = useCallback((event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setShowConfirmModal(false);
    }
  }, []);

  /**
   * The display name for the current user.
   * @type {string}
   */
  const userDisplayName = useMemo(() => {
    if (!currentUser) {
      return '';
    }
    const parts = [currentUser.firstName, currentUser.lastName].filter(Boolean);
    return parts.join(' ') || currentUser.username || '';
  }, [currentUser]);

  /**
   * The role display for the current user.
   * @type {string}
   */
  const userRole = useMemo(() => {
    if (!currentUser) {
      return '';
    }
    return currentUser.role || '';
  }, [currentUser]);

  const containerClassName = classNames('navigation-bar', className);

  return (
    <>
      <header
        className={containerClassName}
        role="banner"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1.5rem',
          backgroundColor: '#1a73e8',
          color: '#ffffff',
          minHeight: '56px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        }}
      >
        {/* Application Title / Logo */}
        <div
          className="navigation-bar__brand"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span
            className="navigation-bar__logo"
            aria-hidden="true"
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            SIG
          </span>
          <span
            className="navigation-bar__title"
            style={{
              fontSize: '1.125rem',
              fontWeight: 500,
              lineHeight: 1.2,
            }}
          >
            Card Management
          </span>
        </div>

        {/* Right side: User info + actions */}
        <div
          className="navigation-bar__actions"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          {/* Current User Display */}
          {isAuthenticated && currentUser && (
            <div
              className="navigation-bar__user"
              aria-label={`Logged in as ${userDisplayName}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                marginRight: '0.5rem',
              }}
            >
              <span
                className="navigation-bar__user-name"
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  lineHeight: 1.3,
                }}
              >
                {userDisplayName}
              </span>
              {userRole && (
                <span
                  className="navigation-bar__user-role"
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 300,
                    lineHeight: 1.3,
                    opacity: 0.85,
                  }}
                >
                  {userRole}
                </span>
              )}
            </div>
          )}

          {/* Cancel / Exit Button */}
          {showCancelButton && (
            <button
              type="button"
              className="hb-btn hb-btn-secondary navigation-bar__cancel-btn"
              onClick={handleCancelClick}
              aria-label="Cancel workflow"
              style={{
                backgroundColor: 'transparent',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.6)',
                borderRadius: '4px',
                padding: '0.375rem 0.75rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
                lineHeight: 1.5,
              }}
            >
              Cancel
            </button>
          )}

          {/* Logout Button */}
          {isAuthenticated && (
            <button
              type="button"
              className="hb-btn navigation-bar__logout-btn"
              onClick={handleLogout}
              aria-label="Log out"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                borderRadius: '4px',
                padding: '0.375rem 0.75rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
                lineHeight: 1.5,
              }}
            >
              Logout
            </button>
          )}
        </div>
      </header>

      {/* Unsaved Changes Confirmation Modal */}
      {showConfirmModal && (
        <div
          className="navigation-bar__modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-confirm-title"
          aria-describedby="cancel-confirm-description"
          onKeyDown={handleModalKeyDown}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            className="navigation-bar__modal hb-card"
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              padding: '1.5rem',
              maxWidth: '480px',
              width: '90%',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
            }}
          >
            <h2
              id="cancel-confirm-title"
              style={{
                fontSize: '1.25rem',
                fontWeight: 500,
                color: '#292929',
                marginBottom: '0.75rem',
              }}
            >
              Unsaved Changes
            </h2>
            <p
              id="cancel-confirm-description"
              style={{
                fontSize: '0.9375rem',
                color: '#555555',
                lineHeight: 1.5,
                marginBottom: '1.5rem',
              }}
            >
              You have unsaved changes that will be lost if you exit. Are you sure you want to cancel and discard all changes?
            </p>
            <div
              className="navigation-bar__modal-actions"
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.75rem',
              }}
            >
              <button
                type="button"
                className="hb-btn hb-btn-secondary"
                onClick={handleDismissModal}
                autoFocus
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  borderRadius: '4px',
                  border: '1px solid #c0c0c0',
                  backgroundColor: '#ffffff',
                  color: '#292929',
                  cursor: 'pointer',
                }}
              >
                Continue Editing
              </button>
              <button
                type="button"
                className="hb-btn hb-btn-primary"
                onClick={handleConfirmCancel}
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: '#d93025',
                  color: '#ffffff',
                  cursor: 'pointer',
                }}
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

NavigationBar.propTypes = {
  className: PropTypes.string,
};

NavigationBar.defaultProps = {
  className: '',
};

export default NavigationBar;