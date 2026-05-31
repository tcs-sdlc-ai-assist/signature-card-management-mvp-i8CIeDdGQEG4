/**
 * Modal component for SIG Card Management.
 * Reusable modal dialog using HB CSS classes (hb-modal, hb-modal-dialog-centered).
 * Supports title, body content, primary/secondary action buttons, and close button.
 * Implements focus trapping for accessibility (tab cycling within modal),
 * Escape key to close, and aria-modal/role='dialog' attributes.
 * Used for confirmation dialogs, session timeout warning, unsaved changes warning,
 * and remove signer confirmation.
 *
 * @module Modal
 * @user-story SCRUM-8955
 * @user-story SCRUM-8958
 * @user-story SCRUM-8964
 * @user-story SCRUM-8965
 */

import { useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { classNames } from '../utils/helpers.js';

/**
 * Selector string for all focusable elements within the modal.
 * @type {string}
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Modal component.
 * Renders a modal dialog overlay with focus trapping, Escape key support,
 * and configurable action buttons.
 *
 * @param {Object} props - Component props.
 * @param {boolean} props.isOpen - Whether the modal is currently open/visible.
 * @param {Function} props.onClose - Callback invoked when the modal is closed (close button, Escape key, or overlay click).
 * @param {string} [props.title] - The modal title displayed in the header.
 * @param {React.ReactNode} [props.children] - The modal body content.
 * @param {string} [props.primaryButtonText] - Text for the primary action button.
 * @param {Function} [props.onPrimaryAction] - Callback invoked when the primary action button is clicked.
 * @param {string} [props.secondaryButtonText] - Text for the secondary action button.
 * @param {Function} [props.onSecondaryAction] - Callback invoked when the secondary action button is clicked.
 * @param {string} [props.primaryButtonVariant='primary'] - Style variant for the primary button ('primary', 'danger').
 * @param {boolean} [props.showCloseButton=true] - Whether to show the close (×) button in the header.
 * @param {boolean} [props.closeOnOverlayClick=true] - Whether clicking the overlay closes the modal.
 * @param {boolean} [props.closeOnEscape=true] - Whether pressing Escape closes the modal.
 * @param {string} [props.className] - Additional CSS class names to apply to the modal dialog.
 * @param {string} [props.ariaLabelledBy] - ID of the element that labels the modal (defaults to internal title ID).
 * @param {string} [props.ariaDescribedBy] - ID of the element that describes the modal.
 * @param {string} [props.size='medium'] - Modal size ('small', 'medium', 'large').
 * @returns {JSX.Element|null} The Modal component, or null if not open.
 */
export function Modal({
  isOpen,
  onClose,
  title,
  children,
  primaryButtonText,
  onPrimaryAction,
  secondaryButtonText,
  onSecondaryAction,
  primaryButtonVariant,
  showCloseButton,
  closeOnOverlayClick,
  closeOnEscape,
  className,
  ariaLabelledBy,
  ariaDescribedBy,
  size,
}) {
  const modalRef = useRef(null);
  const previousActiveElementRef = useRef(null);
  const titleId = useRef(`modal-title-${Math.random().toString(36).slice(2, 9)}`);

  /**
   * Returns the maximum width style based on the size prop.
   * @returns {string} The max-width CSS value.
   */
  const getMaxWidth = useCallback(() => {
    switch (size) {
      case 'small':
        return '400px';
      case 'large':
        return '720px';
      case 'medium':
      default:
        return '540px';
    }
  }, [size]);

  /**
   * Returns the primary button background color based on variant.
   * @returns {string} The background color CSS value.
   */
  const getPrimaryButtonColor = useCallback(() => {
    switch (primaryButtonVariant) {
      case 'danger':
        return '#d93025';
      case 'primary':
      default:
        return '#1a73e8';
    }
  }, [primaryButtonVariant]);

  /**
   * Handles Escape key press to close the modal.
   * @param {KeyboardEvent} event - The keyboard event.
   * @returns {void}
   */
  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Escape' && closeOnEscape) {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }

    // Focus trapping
    if (event.key === 'Tab' && modalRef.current) {
      const focusableElements = modalRef.current.querySelectorAll(FOCUSABLE_SELECTOR);

      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements[focusableElements.length - 1];

      if (event.shiftKey) {
        // Shift+Tab: if focus is on first element, wrap to last
        if (document.activeElement === firstFocusable) {
          event.preventDefault();
          lastFocusable.focus();
        }
      } else {
        // Tab: if focus is on last element, wrap to first
        if (document.activeElement === lastFocusable) {
          event.preventDefault();
          firstFocusable.focus();
        }
      }
    }
  }, [closeOnEscape, onClose]);

  /**
   * Handles overlay click to close the modal.
   * @param {React.MouseEvent} event - The mouse event.
   * @returns {void}
   */
  const handleOverlayClick = useCallback((event) => {
    if (closeOnOverlayClick && event.target === event.currentTarget) {
      onClose();
    }
  }, [closeOnOverlayClick, onClose]);

  /**
   * Handles the close button click.
   * @returns {void}
   */
  const handleCloseClick = useCallback(() => {
    onClose();
  }, [onClose]);

  /**
   * Handles the primary action button click.
   * @returns {void}
   */
  const handlePrimaryClick = useCallback(() => {
    if (typeof onPrimaryAction === 'function') {
      onPrimaryAction();
    }
  }, [onPrimaryAction]);

  /**
   * Handles the secondary action button click.
   * @returns {void}
   */
  const handleSecondaryClick = useCallback(() => {
    if (typeof onSecondaryAction === 'function') {
      onSecondaryAction();
    }
  }, [onSecondaryAction]);

  /**
   * Manages focus when the modal opens and closes.
   * Stores the previously focused element and restores it on close.
   * Sets initial focus to the first focusable element within the modal.
   */
  useEffect(() => {
    if (isOpen) {
      // Store the currently focused element to restore later
      previousActiveElementRef.current = document.activeElement;

      // Prevent body scrolling
      document.body.style.overflow = 'hidden';

      // Focus the first focusable element in the modal after render
      const timer = setTimeout(() => {
        if (modalRef.current) {
          const focusableElements = modalRef.current.querySelectorAll(FOCUSABLE_SELECTOR);
          if (focusableElements.length > 0) {
            focusableElements[0].focus();
          } else {
            // If no focusable elements, focus the modal itself
            modalRef.current.focus();
          }
        }
      }, 0);

      return () => {
        clearTimeout(timer);
      };
    } else {
      // Restore body scrolling
      document.body.style.overflow = '';

      // Restore focus to the previously focused element
      if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === 'function') {
        previousActiveElementRef.current.focus();
        previousActiveElementRef.current = null;
      }
    }
  }, [isOpen]);

  /**
   * Adds and removes the keydown event listener for Escape and Tab handling.
   */
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) {
    return null;
  }

  const resolvedLabelledBy = ariaLabelledBy || (title ? titleId.current : undefined);
  const dialogClassName = classNames('hb-modal', 'hb-modal-dialog-centered', className);
  const hasFooter = primaryButtonText || secondaryButtonText;

  return (
    <div
      className="modal-overlay"
      role="presentation"
      onClick={handleOverlayClick}
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
        ref={modalRef}
        className={dialogClassName}
        role="dialog"
        aria-modal="true"
        aria-labelledby={resolvedLabelledBy}
        aria-describedby={ariaDescribedBy}
        tabIndex={-1}
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          maxWidth: getMaxWidth(),
          width: '90%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
          outline: 'none',
        }}
      >
        {/* Modal Header */}
        {(title || showCloseButton) && (
          <div
            className="modal__header"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1rem 1.5rem',
              borderBottom: '1px solid #e0e0e0',
              flexShrink: 0,
            }}
          >
            {title && (
              <h2
                id={titleId.current}
                className="modal__title"
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 500,
                  color: '#292929',
                  margin: 0,
                  lineHeight: 1.3,
                }}
              >
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                type="button"
                className="modal__close-btn"
                onClick={handleCloseClick}
                aria-label="Close dialog"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '2rem',
                  height: '2rem',
                  padding: 0,
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: '#555555',
                  cursor: 'pointer',
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  lineHeight: 1,
                  borderRadius: '4px',
                  flexShrink: 0,
                  marginLeft: '0.5rem',
                }}
              >
                ×
              </button>
            )}
          </div>
        )}

        {/* Modal Body */}
        <div
          className="modal__body"
          style={{
            padding: '1.5rem',
            overflowY: 'auto',
            flex: '1 1 auto',
            fontSize: '0.9375rem',
            lineHeight: 1.5,
            color: '#555555',
          }}
        >
          {children}
        </div>

        {/* Modal Footer */}
        {hasFooter && (
          <div
            className="modal__footer"
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem',
              padding: '1rem 1.5rem',
              borderTop: '1px solid #e0e0e0',
              flexShrink: 0,
            }}
          >
            {secondaryButtonText && (
              <button
                type="button"
                className="hb-btn hb-btn-secondary modal__secondary-btn"
                onClick={handleSecondaryClick}
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  borderRadius: '4px',
                  border: '1px solid #c0c0c0',
                  backgroundColor: '#ffffff',
                  color: '#292929',
                  cursor: 'pointer',
                  lineHeight: 1.5,
                }}
              >
                {secondaryButtonText}
              </button>
            )}
            {primaryButtonText && (
              <button
                type="button"
                className="hb-btn hb-btn-primary modal__primary-btn"
                onClick={handlePrimaryClick}
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: getPrimaryButtonColor(),
                  color: '#ffffff',
                  cursor: 'pointer',
                  lineHeight: 1.5,
                }}
              >
                {primaryButtonText}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

Modal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string,
  children: PropTypes.node,
  primaryButtonText: PropTypes.string,
  onPrimaryAction: PropTypes.func,
  secondaryButtonText: PropTypes.string,
  onSecondaryAction: PropTypes.func,
  primaryButtonVariant: PropTypes.oneOf(['primary', 'danger']),
  showCloseButton: PropTypes.bool,
  closeOnOverlayClick: PropTypes.bool,
  closeOnEscape: PropTypes.bool,
  className: PropTypes.string,
  ariaLabelledBy: PropTypes.string,
  ariaDescribedBy: PropTypes.string,
  size: PropTypes.oneOf(['small', 'medium', 'large']),
};

Modal.defaultProps = {
  title: '',
  children: null,
  primaryButtonText: '',
  onPrimaryAction: null,
  secondaryButtonText: '',
  onSecondaryAction: null,
  primaryButtonVariant: 'primary',
  showCloseButton: true,
  closeOnOverlayClick: true,
  closeOnEscape: true,
  className: '',
  ariaLabelledBy: '',
  ariaDescribedBy: '',
  size: 'medium',
};

export default Modal;