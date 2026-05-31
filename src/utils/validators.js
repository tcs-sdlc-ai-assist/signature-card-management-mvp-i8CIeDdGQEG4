/**
 * Validation utility functions for SIG Card Management.
 * Each validator returns { valid: boolean, message: string }.
 */

/**
 * Validates that a required field is not empty.
 * @param {string} value - The value to validate.
 * @param {string} [fieldName='This field'] - The name of the field for error messages.
 * @returns {{ valid: boolean, message: string }}
 */
export function validateRequired(value, fieldName = 'This field') {
  if (value === null || value === undefined || String(value).trim() === '') {
    return { valid: false, message: `${fieldName} is required.` };
  }
  return { valid: true, message: '' };
}

/**
 * Validates an email address format.
 * @param {string} email - The email address to validate.
 * @returns {{ valid: boolean, message: string }}
 */
export function validateEmail(email) {
  const requiredCheck = validateRequired(email, 'Email');
  if (!requiredCheck.valid) {
    return requiredCheck;
  }

  const trimmed = String(email).trim();
  // Standard email regex: local@domain.tld
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  if (!emailRegex.test(trimmed)) {
    return { valid: false, message: 'Please enter a valid email address.' };
  }

  return { valid: true, message: '' };
}

/**
 * Validates a phone number format.
 * Accepts digits, spaces, hyphens, parentheses, and an optional leading +.
 * Must contain at least 10 digits.
 * @param {string} phone - The phone number to validate.
 * @returns {{ valid: boolean, message: string }}
 */
export function validatePhone(phone) {
  const requiredCheck = validateRequired(phone, 'Phone number');
  if (!requiredCheck.valid) {
    return requiredCheck;
  }

  const trimmed = String(phone).trim();
  // Allow digits, spaces, hyphens, parentheses, and optional leading +
  const phoneFormatRegex = /^\+?[\d\s()-]+$/;

  if (!phoneFormatRegex.test(trimmed)) {
    return { valid: false, message: 'Phone number contains invalid characters.' };
  }

  // Extract digits only and check minimum count
  const digitsOnly = trimmed.replace(/\D/g, '');
  if (digitsOnly.length < 10) {
    return { valid: false, message: 'Phone number must contain at least 10 digits.' };
  }

  if (digitsOnly.length > 15) {
    return { valid: false, message: 'Phone number must not exceed 15 digits.' };
  }

  return { valid: true, message: '' };
}

/**
 * Validates a person's name.
 * Must be at least 2 characters, only letters, spaces, hyphens, and apostrophes allowed.
 * @param {string} name - The name to validate.
 * @param {string} [fieldName='Name'] - The name of the field for error messages.
 * @returns {{ valid: boolean, message: string }}
 */
export function validateName(name, fieldName = 'Name') {
  const requiredCheck = validateRequired(name, fieldName);
  if (!requiredCheck.valid) {
    return requiredCheck;
  }

  const trimmed = String(name).trim();

  if (trimmed.length < 2) {
    return { valid: false, message: `${fieldName} must be at least 2 characters long.` };
  }

  if (trimmed.length > 100) {
    return { valid: false, message: `${fieldName} must not exceed 100 characters.` };
  }

  const nameRegex = /^[a-zA-Z\s'-]+$/;
  if (!nameRegex.test(trimmed)) {
    return { valid: false, message: `${fieldName} may only contain letters, spaces, hyphens, and apostrophes.` };
  }

  return { valid: true, message: '' };
}

/**
 * Validates a 6-digit OTP code.
 * @param {string} otp - The OTP code to validate.
 * @returns {{ valid: boolean, message: string }}
 */
export function validateOtp(otp) {
  const requiredCheck = validateRequired(otp, 'OTP code');
  if (!requiredCheck.valid) {
    return requiredCheck;
  }

  const trimmed = String(otp).trim();
  const otpRegex = /^\d{6}$/;

  if (!otpRegex.test(trimmed)) {
    return { valid: false, message: 'OTP must be exactly 6 digits.' };
  }

  return { valid: true, message: '' };
}

/**
 * Validates a password.
 * Must be at least 8 characters, contain uppercase, lowercase, a digit, and a special character.
 * @param {string} password - The password to validate.
 * @returns {{ valid: boolean, message: string }}
 */
export function validatePassword(password) {
  const requiredCheck = validateRequired(password, 'Password');
  if (!requiredCheck.valid) {
    return requiredCheck;
  }

  const value = String(password);

  if (value.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long.' };
  }

  if (value.length > 128) {
    return { valid: false, message: 'Password must not exceed 128 characters.' };
  }

  if (!/[A-Z]/.test(value)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter.' };
  }

  if (!/[a-z]/.test(value)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter.' };
  }

  if (!/\d/.test(value)) {
    return { valid: false, message: 'Password must contain at least one digit.' };
  }

  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(value)) {
    return { valid: false, message: 'Password must contain at least one special character.' };
  }

  return { valid: true, message: '' };
}