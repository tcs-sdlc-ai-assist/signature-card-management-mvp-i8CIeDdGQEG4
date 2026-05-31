/**
 * FloatingLabelInput component for SIG Card Management.
 * Reusable floating label input component following HB CSS form patterns.
 * Supports text, email, tel, password input types.
 * Shows/hides password toggle for password fields.
 * Displays inline validation errors with .invaliderr class.
 * Supports required, disabled, maxLength props.
 * Accessible with proper label association, aria-invalid, aria-describedby for errors.
 *
 * @module FloatingLabelInput
 * @user-story SCRUM-8955
 * @user-story SCRUM-8957
 * @user-story SCRUM-8956
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import { classNames } from '../utils/helpers.js';

/**
 * FloatingLabelInput component.
 * Renders a form input with a floating label that animates above the input
 * when the field is focused or has a value. Supports password visibility toggle,
 * inline validation errors, and full accessibility attributes.
 *
 * @param {Object} props - Component props.
 * @param {string} props.id - The unique ID for the input element. Used for label association.
 * @param {string} props.label - The label text displayed as the floating label.
 * @param {string} [props.type='text'] - The input type ('text', 'email', 'tel', 'password').
 * @param {string} [props.name] - The input name attribute. Defaults to the id prop.
 * @param {string} [props.value=''] - The controlled input value.
 * @param {Function} [props.onChange] - Callback invoked when the input value changes. Receives the React change event.
 * @param {Function} [props.onBlur] - Callback invoked when the input loses focus. Receives the React blur event.
 * @param {Function} [props.onFocus] - Callback invoked when the input gains focus. Receives the React focus event.
 * @param {string} [props.error=''] - The inline validation error message to display below the input.
 * @param {boolean} [props.required=false] - Whether the input is required.
 * @param {boolean} [props.disabled=false] - Whether the input is disabled.
 * @param {number} [props.maxLength] - The maximum number of characters allowed.
 * @param {string} [props.placeholder=''] - Placeholder text (shown when label is floating).
 * @param {string} [props.autoComplete] - The autocomplete attribute for the input.
 * @param {string} [props.className] - Additional CSS class names to apply to the container.
 * @param {string} [props.inputClassName] - Additional CSS class names to apply to the input element.
 * @param {boolean} [props.readOnly=false] - Whether the input is read-only.
 * @param {string} [props.ariaLabel] - Override aria-label for the input.
 * @param {string} [props.ariaDescribedBy] - Additional aria-describedby IDs.
 * @returns {JSX.Element} The FloatingLabelInput component.
 */
export function FloatingLabelInput({
  id,
  label,
  type,
  name,
  value,
  onChange,
  onBlur,
  onFocus,
  error,
  required,
  disabled,
  maxLength,
  placeholder,
  autoComplete,
  className,
  inputClassName,
  readOnly,
  ariaLabel,
  ariaDescribedBy,
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const inputRef = useRef(null);

  /**
   * The error element ID for aria-describedby association.
   * @type {string}
   */
  const errorId = useMemo(() => `${id}-error`, [id]);

  /**
   * Whether the label should float above the input.
   * Floats when the input is focused or has a value.
   * @type {boolean}
   */
  const isFloating = useMemo(() => {
    return isFocused || (value !== undefined && value !== null && String(value).length > 0);
  }, [isFocused, value]);

  /**
   * Whether the input has a validation error.
   * @type {boolean}
   */
  const hasError = useMemo(() => {
    return error !== undefined && error !== null && String(error).trim().length > 0;
  }, [error]);

  /**
   * The resolved input type, accounting for password visibility toggle.
   * @type {string}
   */
  const resolvedType = useMemo(() => {
    if (type === 'password' && showPassword) {
      return 'text';
    }
    return type;
  }, [type, showPassword]);

  /**
   * The resolved aria-describedby value, combining error ID and any additional IDs.
   * @type {string|undefined}
   */
  const resolvedAriaDescribedBy = useMemo(() => {
    const parts = [];
    if (hasError) {
      parts.push(errorId);
    }
    if (ariaDescribedBy && typeof ariaDescribedBy === 'string' && ariaDescribedBy.trim()) {
      parts.push(ariaDescribedBy.trim());
    }
    return parts.length > 0 ? parts.join(' ') : undefined;
  }, [hasError, errorId, ariaDescribedBy]);

  /**
   * Handles the input focus event.
   * @param {React.FocusEvent<HTMLInputElement>} event - The focus event.
   * @returns {void}
   */
  const handleFocus = useCallback((event) => {
    setIsFocused(true);
    if (typeof onFocus === 'function') {
      onFocus(event);
    }
  }, [onFocus]);

  /**
   * Handles the input blur event.
   * @param {React.FocusEvent<HTMLInputElement>} event - The blur event.
   * @returns {void}
   */
  const handleBlur = useCallback((event) => {
    setIsFocused(false);
    if (typeof onBlur === 'function') {
      onBlur(event);
    }
  }, [onBlur]);

  /**
   * Handles the input change event.
   * @param {React.ChangeEvent<HTMLInputElement>} event - The change event.
   * @returns {void}
   */
  const handleChange = useCallback((event) => {
    if (typeof onChange === 'function') {
      onChange(event);
    }
  }, [onChange]);

  /**
   * Toggles the password visibility.
   * @returns {void}
   */
  const handleTogglePassword = useCallback(() => {
    setShowPassword((prev) => !prev);
    // Refocus the input after toggling
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  /**
   * Handles keyboard interaction on the password toggle button.
   * @param {React.KeyboardEvent} event - The keyboard event.
   * @returns {void}
   */
  const handleToggleKeyDown = useCallback((event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleTogglePassword();
    }
  }, [handleTogglePassword]);

  const containerClassName = classNames(
    'floating-label-input',
    {
      'floating-label-input--focused': isFocused,
      'floating-label-input--floating': isFloating,
      'floating-label-input--error': hasError,
      'floating-label-input--disabled': disabled,
    },
    className
  );

  const inputClassNameResolved = classNames(
    'hb-input',
    'floating-label-input__input',
    {
      'floating-label-input__input--error': hasError,
      'floating-label-input__input--password': type === 'password',
    },
    inputClassName
  );

  return (
    <div
      className={containerClassName}
      style={{
        position: 'relative',
        marginBottom: '1.25rem',
        width: '100%',
      }}
    >
      <div
        className="floating-label-input__wrapper"
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <input
          ref={inputRef}
          id={id}
          name={name || id}
          type={resolvedType}
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          required={required}
          disabled={disabled}
          readOnly={readOnly}
          maxLength={maxLength}
          placeholder={isFloating ? placeholder : ''}
          autoComplete={autoComplete}
          aria-invalid={hasError ? 'true' : undefined}
          aria-describedby={resolvedAriaDescribedBy}
          aria-required={required ? 'true' : undefined}
          aria-label={ariaLabel || undefined}
          className={inputClassNameResolved}
          style={{
            width: '100%',
            padding: isFloating ? '1.25rem 0.75rem 0.375rem' : '0.75rem',
            paddingRight: type === 'password' ? '3rem' : '0.75rem',
            fontSize: '0.9375rem',
            lineHeight: 1.5,
            color: disabled ? '#757575' : '#292929',
            backgroundColor: disabled ? '#f5f5f5' : '#ffffff',
            border: hasError
              ? '1px solid #d93025'
              : isFocused
                ? '1px solid #1a73e8'
                : '1px solid #c0c0c0',
            borderRadius: '4px',
            outline: 'none',
            transition: 'border-color 0.2s ease, padding 0.2s ease',
            boxShadow: isFocused && !hasError
              ? '0 0 0 2px rgba(26, 115, 232, 0.2)'
              : hasError && isFocused
                ? '0 0 0 2px rgba(217, 48, 37, 0.2)'
                : 'none',
          }}
        />

        {/* Floating Label */}
        <label
          htmlFor={id}
          className={classNames('floating-label-input__label', {
            'floating-label-input__label--floating': isFloating,
            'floating-label-input__label--error': hasError,
          })}
          style={{
            position: 'absolute',
            left: '0.75rem',
            top: isFloating ? '0.25rem' : '50%',
            transform: isFloating ? 'none' : 'translateY(-50%)',
            fontSize: isFloating ? '0.75rem' : '0.9375rem',
            fontWeight: isFloating ? 500 : 400,
            color: hasError
              ? '#d93025'
              : isFocused
                ? '#1a73e8'
                : '#757575',
            pointerEvents: 'none',
            transition: 'all 0.2s ease',
            lineHeight: 1.2,
            backgroundColor: isFloating ? '#ffffff' : 'transparent',
            padding: isFloating ? '0 0.25rem' : '0',
            zIndex: 1,
          }}
        >
          {label}
          {required && (
            <span
              className="floating-label-input__required"
              aria-hidden="true"
              style={{
                color: '#d93025',
                marginLeft: '0.125rem',
              }}
            >
              *
            </span>
          )}
        </label>

        {/* Password Toggle Button */}
        {type === 'password' && (
          <button
            type="button"
            className="floating-label-input__toggle-password"
            onClick={handleTogglePassword}
            onKeyDown={handleToggleKeyDown}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            tabIndex={0}
            disabled={disabled}
            style={{
              position: 'absolute',
              right: '0.5rem',
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '2rem',
              height: '2rem',
              padding: 0,
              border: 'none',
              backgroundColor: 'transparent',
              color: '#757575',
              cursor: disabled ? 'default' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500,
              lineHeight: 1,
              borderRadius: '4px',
              zIndex: 2,
            }}
          >
            {showPassword ? '🙈' : '👁'}
          </button>
        )}
      </div>

      {/* Inline Validation Error */}
      {hasError && (
        <div
          id={errorId}
          className="invaliderr floating-label-input__error"
          role="alert"
          aria-live="polite"
          style={{
            fontSize: '0.8125rem',
            lineHeight: 1.4,
            color: '#d93025',
            marginTop: '0.25rem',
            paddingLeft: '0.75rem',
            fontWeight: 400,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

FloatingLabelInput.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  type: PropTypes.oneOf(['text', 'email', 'tel', 'password']),
  name: PropTypes.string,
  value: PropTypes.string,
  onChange: PropTypes.func,
  onBlur: PropTypes.func,
  onFocus: PropTypes.func,
  error: PropTypes.string,
  required: PropTypes.bool,
  disabled: PropTypes.bool,
  maxLength: PropTypes.number,
  placeholder: PropTypes.string,
  autoComplete: PropTypes.string,
  className: PropTypes.string,
  inputClassName: PropTypes.string,
  readOnly: PropTypes.bool,
  ariaLabel: PropTypes.string,
  ariaDescribedBy: PropTypes.string,
};

FloatingLabelInput.defaultProps = {
  type: 'text',
  name: '',
  value: '',
  onChange: null,
  onBlur: null,
  onFocus: null,
  error: '',
  required: false,
  disabled: false,
  maxLength: undefined,
  placeholder: '',
  autoComplete: undefined,
  className: '',
  inputClassName: '',
  readOnly: false,
  ariaLabel: '',
  ariaDescribedBy: '',
};

export default FloatingLabelInput;