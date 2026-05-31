/**
 * General utility / helper functions for SIG Card Management.
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Masks an account number, showing only the last 4 digits.
 * @param {string} accountNumber - The full account number.
 * @returns {string} The masked account number (e.g., "****1234").
 */
export function maskAccountNumber(accountNumber) {
  if (!accountNumber || typeof accountNumber !== 'string') {
    return '';
  }
  const trimmed = accountNumber.trim();
  if (trimmed.length <= 4) {
    return trimmed;
  }
  const lastFour = trimmed.slice(-4);
  const masked = '*'.repeat(trimmed.length - 4);
  return `${masked}${lastFour}`;
}

/**
 * Generates a unique reference ID based on UUID v4.
 * @returns {string} A UUID-based reference ID.
 */
export function generateReferenceId() {
  return uuidv4();
}

/**
 * Generates a random 6-digit OTP code.
 * @returns {string} A 6-digit OTP string (zero-padded).
 */
export function generateOtp() {
  const otp = Math.floor(Math.random() * 1000000);
  return String(otp).padStart(6, '0');
}

/**
 * Formats a Date object or timestamp into a full timestamp string.
 * Format: "MM/DD/YYYY, HH:MM:SS AM/PM"
 * @param {Date|number|string} date - The date to format.
 * @returns {string} The formatted timestamp string.
 */
export function formatTimestamp(date) {
  if (!date) {
    return '';
  }
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) {
      return '';
    }
    return d.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch (_e) {
    return '';
  }
}

/**
 * Formats a Date object or timestamp into a date-only string.
 * Format: "MM/DD/YYYY"
 * @param {Date|number|string} date - The date to format.
 * @returns {string} The formatted date string.
 */
export function formatDate(date) {
  if (!date) {
    return '';
  }
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) {
      return '';
    }
    return d.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    });
  } catch (_e) {
    return '';
  }
}

/**
 * Checks whether a given date is today (based on local calendar day).
 * @param {Date|number|string} date - The date to check.
 * @returns {boolean} True if the date is today, false otherwise.
 */
export function isToday(date) {
  if (!date) {
    return false;
  }
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) {
      return false;
    }
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  } catch (_e) {
    return false;
  }
}

/**
 * Returns a string key representing the calendar day of a given date.
 * Useful for grouping or comparing dates by day.
 * Format: "YYYY-MM-DD"
 * @param {Date|number|string} [date] - The date to get the key for. Defaults to now.
 * @returns {string} The calendar day key (e.g., "2024-01-15").
 */
export function getCalendarDayKey(date) {
  try {
    const d = date ? (date instanceof Date ? date : new Date(date)) : new Date();
    if (isNaN(d.getTime())) {
      return '';
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (_e) {
    return '';
  }
}

/**
 * Creates a debounced version of a function that delays invocation
 * until after the specified wait time has elapsed since the last call.
 * @param {Function} fn - The function to debounce.
 * @param {number} wait - The debounce delay in milliseconds.
 * @returns {Function} The debounced function with a .cancel() method.
 */
export function debounce(fn, wait) {
  let timeoutId = null;

  function debounced(...args) {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      timeoutId = null;
      fn.apply(this, args);
    }, wait);
  }

  debounced.cancel = function cancel() {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced;
}

/**
 * Conditionally joins CSS class names together.
 * Accepts strings, objects (where keys are class names and values are booleans),
 * arrays, or falsy values (which are ignored).
 * @param {...(string|Object<string, boolean>|Array|undefined|null|false)} args - Class name arguments.
 * @returns {string} The joined class name string.
 *
 * @example
 * classNames('btn', 'btn-primary');
 * // => 'btn btn-primary'
 *
 * classNames('btn', { 'btn-active': true, 'btn-disabled': false });
 * // => 'btn btn-active'
 *
 * classNames('btn', ['btn-lg', { 'btn-block': true }]);
 * // => 'btn btn-lg btn-block'
 */
export function classNames(...args) {
  const classes = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (!arg) {
      continue;
    }

    if (typeof arg === 'string') {
      classes.push(arg);
    } else if (Array.isArray(arg)) {
      const inner = classNames(...arg);
      if (inner) {
        classes.push(inner);
      }
    } else if (typeof arg === 'object') {
      const keys = Object.keys(arg);
      for (let j = 0; j < keys.length; j++) {
        if (arg[keys[j]]) {
          classes.push(keys[j]);
        }
      }
    }
  }

  return classes.join(' ');
}