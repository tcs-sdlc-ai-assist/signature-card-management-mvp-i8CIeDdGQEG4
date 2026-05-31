/**
 * LocalStorage abstraction layer for SIG Card Management.
 * Provides namespaced keys (SCM_*) to avoid collisions with other applications.
 * All values are JSON serialized/deserialized automatically.
 * Includes error handling for quota exceeded, parsing errors, and unavailable storage.
 */

/** @type {string} Namespace prefix for all storage keys */
const NAMESPACE = 'SCM_';

/**
 * Builds a namespaced storage key.
 * @param {string} key - The base key name.
 * @returns {string} The namespaced key (e.g., "SCM_auth_token").
 */
function namespacedKey(key) {
  if (!key || typeof key !== 'string') {
    return NAMESPACE;
  }
  return `${NAMESPACE}${key}`;
}

/**
 * Checks whether localStorage is available in the current environment.
 * @returns {boolean} True if localStorage is available, false otherwise.
 */
function isStorageAvailable() {
  try {
    const testKey = `${NAMESPACE}__storage_test__`;
    window.localStorage.setItem(testKey, 'test');
    window.localStorage.removeItem(testKey);
    return true;
  } catch (_e) {
    return false;
  }
}

/**
 * Retrieves a value from localStorage by key.
 * Automatically deserializes JSON values.
 * @param {string} key - The base key name (without namespace prefix).
 * @param {*} [defaultValue=null] - The default value to return if the key does not exist or an error occurs.
 * @returns {*} The deserialized value, or the default value if not found or on error.
 */
export function getItem(key, defaultValue = null) {
  if (!isStorageAvailable()) {
    console.warn('localStorage is not available.');
    return defaultValue;
  }

  try {
    const raw = window.localStorage.getItem(namespacedKey(key));
    if (raw === null) {
      return defaultValue;
    }
    return JSON.parse(raw);
  } catch (_e) {
    console.error(`Failed to read key "${key}" from localStorage.`);
    return defaultValue;
  }
}

/**
 * Stores a value in localStorage under a namespaced key.
 * Automatically serializes the value to JSON.
 * @param {string} key - The base key name (without namespace prefix).
 * @param {*} value - The value to store (must be JSON-serializable).
 * @returns {boolean} True if the value was stored successfully, false otherwise.
 */
export function setItem(key, value) {
  if (!isStorageAvailable()) {
    console.warn('localStorage is not available.');
    return false;
  }

  try {
    const serialized = JSON.stringify(value);
    window.localStorage.setItem(namespacedKey(key), serialized);
    return true;
  } catch (e) {
    if (e instanceof DOMException && (
      e.code === 22 ||
      e.code === 1014 ||
      e.name === 'QuotaExceededError' ||
      e.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    )) {
      console.error(`localStorage quota exceeded when setting key "${key}".`);
    } else {
      console.error(`Failed to write key "${key}" to localStorage.`);
    }
    return false;
  }
}

/**
 * Removes a value from localStorage by key.
 * @param {string} key - The base key name (without namespace prefix).
 * @returns {boolean} True if the removal was successful, false otherwise.
 */
export function removeItem(key) {
  if (!isStorageAvailable()) {
    console.warn('localStorage is not available.');
    return false;
  }

  try {
    window.localStorage.removeItem(namespacedKey(key));
    return true;
  } catch (_e) {
    console.error(`Failed to remove key "${key}" from localStorage.`);
    return false;
  }
}

/**
 * Clears all namespaced (SCM_*) keys from localStorage.
 * Does not affect keys from other applications.
 * @returns {boolean} True if the clear was successful, false otherwise.
 */
export function clear() {
  if (!isStorageAvailable()) {
    console.warn('localStorage is not available.');
    return false;
  }

  try {
    const keysToRemove = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const storageKey = window.localStorage.key(i);
      if (storageKey && storageKey.startsWith(NAMESPACE)) {
        keysToRemove.push(storageKey);
      }
    }
    for (let i = 0; i < keysToRemove.length; i++) {
      window.localStorage.removeItem(keysToRemove[i]);
    }
    return true;
  } catch (_e) {
    console.error('Failed to clear namespaced keys from localStorage.');
    return false;
  }
}

/**
 * Returns all namespaced keys currently stored in localStorage (without the namespace prefix).
 * @returns {string[]} An array of key names (without the SCM_ prefix).
 */
export function getAllKeys() {
  if (!isStorageAvailable()) {
    console.warn('localStorage is not available.');
    return [];
  }

  try {
    const keys = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const storageKey = window.localStorage.key(i);
      if (storageKey && storageKey.startsWith(NAMESPACE)) {
        keys.push(storageKey.slice(NAMESPACE.length));
      }
    }
    return keys;
  } catch (_e) {
    console.error('Failed to retrieve keys from localStorage.');
    return [];
  }
}