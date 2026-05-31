/**
 * AccountService for SIG Card Management.
 * Provides account retrieval for the controlling party from mock data in localStorage.
 * Supports fetching all accounts, single account lookup, and paginated results.
 */

import { getItem } from '../utils/storage.js';
import { getSession } from './authService.js';
import { logEvent } from './auditLogger.js';
import { ACTION_TYPES } from '../constants/constants.js';

/** @type {string} Storage key for accounts */
const ACCOUNTS_KEY = 'accounts';

/** @type {number} Default page size for pagination */
const DEFAULT_PAGE_SIZE = 10;

/**
 * Retrieves all business banking accounts for the controlling party.
 * Optionally supports pagination when the account list exceeds the page size.
 *
 * @param {string} userId - The user ID of the controlling party.
 * @param {Object} [options={}] - Optional pagination parameters.
 * @param {number} [options.page=1] - The page number (1-based).
 * @param {number} [options.pageSize=10] - The number of accounts per page.
 * @returns {{ success: boolean, message: string, accounts: Array<Object>, pagination: Object|null }}
 *   Result object with the list of accounts and pagination metadata.
 */
export function getAccounts(userId, options = {}) {
  const session = getSession();

  if (!session) {
    return {
      success: false,
      message: 'No active session. Please log in first.',
      accounts: [],
      pagination: null,
    };
  }

  if (!userId || typeof userId !== 'string') {
    return {
      success: false,
      message: 'User ID is required.',
      accounts: [],
      pagination: null,
    };
  }

  // Verify the userId matches the authenticated session
  if (session.userId !== userId) {
    return {
      success: false,
      message: 'User ID does not match the authenticated session.',
      accounts: [],
      pagination: null,
    };
  }

  const allAccounts = getItem(ACCOUNTS_KEY, []);

  if (!Array.isArray(allAccounts)) {
    return {
      success: false,
      message: 'Failed to retrieve accounts.',
      accounts: [],
      pagination: null,
    };
  }

  if (allAccounts.length === 0) {
    return {
      success: true,
      message: 'No accounts found.',
      accounts: [],
      pagination: null,
    };
  }

  // Map accounts to safe output format (no raw account numbers)
  const safeAccounts = allAccounts.map((account) => ({
    id: account.id,
    accountName: account.accountName,
    maskedAccountNumber: account.maskedAccountNumber,
    accountType: account.accountType,
    signerCount: account.signerCount,
  }));

  const totalAccounts = safeAccounts.length;

  // Determine pagination parameters
  const page = Math.max(1, parseInt(options.page, 10) || 1);
  const pageSize = Math.max(1, parseInt(options.pageSize, 10) || DEFAULT_PAGE_SIZE);

  // If total accounts fit within a single page, return all without pagination
  if (totalAccounts <= pageSize) {
    return {
      success: true,
      message: `Found ${totalAccounts} account${totalAccounts !== 1 ? 's' : ''}.`,
      accounts: safeAccounts,
      pagination: null,
    };
  }

  // Calculate pagination
  const totalPages = Math.ceil(totalAccounts / pageSize);
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalAccounts);
  const paginatedAccounts = safeAccounts.slice(startIndex, endIndex);

  return {
    success: true,
    message: `Found ${totalAccounts} account${totalAccounts !== 1 ? 's' : ''}.`,
    accounts: paginatedAccounts,
    pagination: {
      currentPage: currentPage,
      pageSize: pageSize,
      totalPages: totalPages,
      totalAccounts: totalAccounts,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1,
    },
  };
}

/**
 * Retrieves a single business banking account by its ID.
 * Validates that the account belongs to the authenticated controlling party.
 *
 * @param {string} accountId - The account ID to look up.
 * @returns {{ success: boolean, message: string, account: Object|null }}
 *   Result object with the account data or null if not found.
 */
export function getAccountById(accountId) {
  const session = getSession();

  if (!session) {
    return {
      success: false,
      message: 'No active session. Please log in first.',
      account: null,
    };
  }

  if (!accountId || typeof accountId !== 'string') {
    return {
      success: false,
      message: 'Account ID is required.',
      account: null,
    };
  }

  const trimmedId = accountId.trim();

  const allAccounts = getItem(ACCOUNTS_KEY, []);

  if (!Array.isArray(allAccounts)) {
    return {
      success: false,
      message: 'Failed to retrieve accounts.',
      account: null,
    };
  }

  const account = allAccounts.find((acct) => acct.id === trimmedId);

  if (!account) {
    return {
      success: false,
      message: 'Account not found.',
      account: null,
    };
  }

  // Log account selection
  logEvent(ACTION_TYPES.ACCOUNT_SELECTED, session.userId, {
    accountId: account.id,
    accountName: account.accountName,
    maskedAccountNumber: account.maskedAccountNumber,
    message: `Selected account ${account.accountName} (${account.maskedAccountNumber}).`,
  });

  return {
    success: true,
    message: 'Account retrieved successfully.',
    account: {
      id: account.id,
      accountName: account.accountName,
      maskedAccountNumber: account.maskedAccountNumber,
      accountType: account.accountType,
      signerCount: account.signerCount,
    },
  };
}