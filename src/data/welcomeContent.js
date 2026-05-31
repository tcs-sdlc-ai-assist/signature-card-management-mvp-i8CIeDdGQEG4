/**
 * Welcome screen content configuration for SIG Card Management.
 * Provides default content (title, subtitle, steps list, CTA text) for the welcome/onboarding screen.
 * ContentManager service reads/writes this to localStorage for admin editability without code changes.
 * Serves as the initial content seed.
 */

import { getItem, setItem } from '../utils/storage.js';

/** @type {string} Storage key for welcome content */
const WELCOME_CONTENT_KEY = 'welcome_content';

/**
 * Default welcome screen content configuration.
 * @type {Object}
 */
export const DEFAULT_WELCOME_CONTENT = Object.freeze({
  title: 'Welcome to SIG Card Management',
  subtitle:
    'Manage authorized signers and signature cards for your business banking accounts securely and efficiently.',
  steps: [
    {
      id: 'step-1',
      number: 1,
      title: 'Verify Your Identity',
      description:
        'Log in with your credentials and complete identity verification to ensure secure access.',
    },
    {
      id: 'step-2',
      number: 2,
      title: 'Select Your Account',
      description:
        'Choose the business banking account you want to manage signature cards for.',
    },
    {
      id: 'step-3',
      number: 3,
      title: 'Manage Signers',
      description:
        'Add, edit, or remove authorized signers on your account. Update signer details as needed.',
    },
    {
      id: 'step-4',
      number: 4,
      title: 'Review & Submit',
      description:
        'Review all changes and submit your updated signature card for processing.',
    },
  ],
  ctaText: 'Get Started',
  footerNote:
    'Need help? Contact your business banking representative for assistance.',
});

/**
 * Retrieves the welcome content from localStorage.
 * Falls back to the default content if not found.
 * @returns {Object} The welcome content configuration.
 */
export function getWelcomeContent() {
  const stored = getItem(WELCOME_CONTENT_KEY, null);
  if (stored) {
    return stored;
  }
  return { ...DEFAULT_WELCOME_CONTENT, steps: [...DEFAULT_WELCOME_CONTENT.steps] };
}

/**
 * Saves welcome content to localStorage.
 * @param {Object} content - The welcome content configuration to save.
 * @returns {boolean} True if saved successfully, false otherwise.
 */
export function setWelcomeContent(content) {
  if (!content || typeof content !== 'object') {
    console.error('Invalid welcome content provided.');
    return false;
  }
  return setItem(WELCOME_CONTENT_KEY, content);
}

/**
 * Resets welcome content in localStorage to the default configuration.
 * @returns {boolean} True if reset successfully, false otherwise.
 */
export function resetWelcomeContent() {
  return setItem(WELCOME_CONTENT_KEY, DEFAULT_WELCOME_CONTENT);
}

/**
 * Initializes welcome content in localStorage if not already present.
 * @returns {void}
 */
export function initializeWelcomeContent() {
  const existing = getItem(WELCOME_CONTENT_KEY, null);
  if (!existing) {
    setItem(WELCOME_CONTENT_KEY, DEFAULT_WELCOME_CONTENT);
  }
}