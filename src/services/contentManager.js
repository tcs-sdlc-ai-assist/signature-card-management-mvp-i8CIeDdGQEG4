/**
 * ContentManager service for SIG Card Management.
 * Provides read/write access to welcome screen content stored in localStorage.
 * Enables admin content editing without code deployment.
 */

import {
  getWelcomeContent as readWelcomeContent,
  setWelcomeContent,
  resetWelcomeContent,
  initializeWelcomeContent,
} from '../data/welcomeContent.js';

/**
 * Retrieves the current welcome screen content from localStorage.
 * Falls back to the default content if nothing is stored.
 * @returns {Object} The welcome content configuration object with title, subtitle, steps, ctaText, and footerNote.
 */
export function getWelcomeContent() {
  initializeWelcomeContent();
  return readWelcomeContent();
}

/**
 * Updates the welcome screen content in localStorage.
 * Validates that the provided content object contains the required fields before saving.
 * Enables admin content editing without code deployment.
 * @param {Object} content - The welcome content configuration to save.
 * @param {string} [content.title] - The welcome screen title.
 * @param {string} [content.subtitle] - The welcome screen subtitle.
 * @param {Array<Object>} [content.steps] - The onboarding steps list.
 * @param {string} [content.ctaText] - The call-to-action button text.
 * @param {string} [content.footerNote] - The footer note text.
 * @returns {{ success: boolean, message: string }} Result indicating whether the update succeeded.
 */
export function updateWelcomeContent(content) {
  if (!content || typeof content !== 'object' || Array.isArray(content)) {
    return { success: false, message: 'Invalid content: must be a non-null object.' };
  }

  const currentContent = readWelcomeContent();

  const merged = {
    ...currentContent,
    ...content,
  };

  if (!merged.title || typeof merged.title !== 'string') {
    return { success: false, message: 'Content must include a valid title string.' };
  }

  if (!merged.subtitle || typeof merged.subtitle !== 'string') {
    return { success: false, message: 'Content must include a valid subtitle string.' };
  }

  if (!Array.isArray(merged.steps) || merged.steps.length === 0) {
    return { success: false, message: 'Content must include a non-empty steps array.' };
  }

  for (let i = 0; i < merged.steps.length; i++) {
    const step = merged.steps[i];
    if (!step || typeof step !== 'object') {
      return { success: false, message: `Step at index ${i} must be a valid object.` };
    }
    if (!step.title || typeof step.title !== 'string') {
      return { success: false, message: `Step at index ${i} must have a valid title string.` };
    }
    if (!step.description || typeof step.description !== 'string') {
      return { success: false, message: `Step at index ${i} must have a valid description string.` };
    }
  }

  if (!merged.ctaText || typeof merged.ctaText !== 'string') {
    return { success: false, message: 'Content must include a valid ctaText string.' };
  }

  const saved = setWelcomeContent(merged);

  if (!saved) {
    return { success: false, message: 'Failed to save content to localStorage.' };
  }

  return { success: true, message: 'Welcome content updated successfully.' };
}

/**
 * Resets the welcome screen content to the default configuration.
 * @returns {{ success: boolean, message: string }} Result indicating whether the reset succeeded.
 */
export function resetContent() {
  const result = resetWelcomeContent();

  if (!result) {
    return { success: false, message: 'Failed to reset content in localStorage.' };
  }

  return { success: true, message: 'Welcome content reset to defaults.' };
}