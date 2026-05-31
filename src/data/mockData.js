/**
 * Mock data fixtures for SIG Card Management.
 * Provides controlling party user, business banking accounts, authorized signers,
 * eSign KYC tokens, OTP delivery contacts, rate-limit counters, and initial audit log entries.
 * Initializes localStorage on first load if not present.
 */

import { maskAccountNumber } from '../utils/helpers.js';
import { getItem, setItem } from '../utils/storage.js';
import { SIGNER_STATUSES } from '../constants/constants.js';

/**
 * Controlling party user credentials and contact info.
 * @type {Object}
 */
export const MOCK_USER = {
  id: 'usr-001',
  username: 'jsmith',
  password: 'Test@1234',
  firstName: 'John',
  lastName: 'Smith',
  email: 'john.smith@example.com',
  phone: '(555) 123-4567',
  role: 'Controlling Party',
  lastLogin: '2024-11-15T09:30:00Z',
};

/**
 * Business banking accounts with masked numbers, types, and signer counts.
 * @type {Array<Object>}
 */
export const MOCK_ACCOUNTS = [
  {
    id: 'acct-1001',
    accountNumber: '7294810035',
    maskedAccountNumber: maskAccountNumber('7294810035'),
    accountName: 'Smith Enterprises Operating',
    accountType: 'Business Checking',
    signerCount: 3,
  },
  {
    id: 'acct-1002',
    accountNumber: '7294810042',
    maskedAccountNumber: maskAccountNumber('7294810042'),
    accountName: 'Smith Enterprises Payroll',
    accountType: 'Business Checking',
    signerCount: 2,
  },
  {
    id: 'acct-1003',
    accountNumber: '8301547729',
    maskedAccountNumber: maskAccountNumber('8301547729'),
    accountName: 'Smith Enterprises Reserve',
    accountType: 'Business Savings',
    signerCount: 1,
  },
];

/**
 * Authorized signers per account.
 * Keyed by account ID.
 * @type {Object<string, Array<Object>>}
 */
export const MOCK_SIGNERS = {
  'acct-1001': [
    {
      id: 'sig-101',
      firstName: 'John',
      lastName: 'Smith',
      role: 'Primary Signer',
      status: SIGNER_STATUSES.ACTIVE,
      email: 'john.smith@example.com',
      phone: '(555) 123-4567',
      cardStatus: 'active',
      addedDate: '2023-06-15T10:00:00Z',
    },
    {
      id: 'sig-102',
      firstName: 'Jane',
      lastName: 'Doe',
      role: 'Authorized Signer',
      status: SIGNER_STATUSES.ACTIVE,
      email: 'jane.doe@example.com',
      phone: '(555) 234-5678',
      cardStatus: 'active',
      addedDate: '2023-07-20T14:30:00Z',
    },
    {
      id: 'sig-103',
      firstName: 'Robert',
      lastName: 'Johnson',
      role: 'Authorized Signer',
      status: SIGNER_STATUSES.LOCKED,
      email: 'robert.johnson@example.com',
      phone: '(555) 345-6789',
      cardStatus: 'locked',
      addedDate: '2023-09-10T08:15:00Z',
    },
  ],
  'acct-1002': [
    {
      id: 'sig-201',
      firstName: 'John',
      lastName: 'Smith',
      role: 'Primary Signer',
      status: SIGNER_STATUSES.ACTIVE,
      email: 'john.smith@example.com',
      phone: '(555) 123-4567',
      cardStatus: 'active',
      addedDate: '2023-06-15T10:00:00Z',
    },
    {
      id: 'sig-202',
      firstName: 'Emily',
      lastName: 'Chen',
      role: 'Authorized Signer',
      status: SIGNER_STATUSES.PENDING,
      email: 'emily.chen@example.com',
      phone: '(555) 456-7890',
      cardStatus: 'pending',
      addedDate: '2024-01-05T11:45:00Z',
    },
  ],
  'acct-1003': [
    {
      id: 'sig-301',
      firstName: 'John',
      lastName: 'Smith',
      role: 'Primary Signer',
      status: SIGNER_STATUSES.ACTIVE,
      email: 'john.smith@example.com',
      phone: '(555) 123-4567',
      cardStatus: 'active',
      addedDate: '2023-06-15T10:00:00Z',
    },
  ],
};

/**
 * eSign KYC tokens for identity verification.
 * @type {Object<string, Object>}
 */
export const MOCK_ESIGN_TOKENS = {
  valid: {
    token: 'esign-tok-valid-abc123',
    status: 'valid',
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    userId: 'usr-001',
  },
  expired: {
    token: 'esign-tok-expired-xyz789',
    status: 'expired',
    issuedAt: '2024-01-01T00:00:00Z',
    expiresAt: '2024-01-02T00:00:00Z',
    userId: 'usr-001',
  },
  invalid: {
    token: 'esign-tok-invalid-000',
    status: 'invalid',
    issuedAt: null,
    expiresAt: null,
    userId: null,
  },
};

/**
 * OTP delivery contacts for the controlling party.
 * @type {Array<Object>}
 */
export const MOCK_OTP_CONTACTS = [
  {
    id: 'contact-sms-1',
    method: 'sms',
    label: 'Mobile ending in 4567',
    value: '(555) 123-4567',
    masked: '(***) ***-4567',
  },
  {
    id: 'contact-email-1',
    method: 'email',
    label: 'Email j***@example.com',
    value: 'john.smith@example.com',
    masked: 'j***@example.com',
  },
];

/**
 * Initial rate-limit counters.
 * @type {Object}
 */
export const MOCK_RATE_LIMITS = {
  loginAttempts: 0,
  loginLastAttemptDate: null,
  otpAttempts: 0,
  otpResendAttempts: 0,
  otpResendLastDate: null,
  unlockAttempts: 0,
  unlockLastDate: null,
};

/**
 * Initial audit log entries.
 * @type {Array<Object>}
 */
export const MOCK_AUDIT_LOG = [
  {
    id: 'audit-001',
    action: 'LOGIN',
    userId: 'usr-001',
    timestamp: '2024-11-15T09:30:00Z',
    details: 'User logged in successfully.',
    ipAddress: '192.168.1.100',
  },
  {
    id: 'audit-002',
    action: 'ACCOUNT_SELECTED',
    userId: 'usr-001',
    timestamp: '2024-11-15T09:31:15Z',
    details: 'Selected account Smith Enterprises Operating (******0035).',
    ipAddress: '192.168.1.100',
  },
];

/** @type {string} Storage key for mock data initialization flag */
const INIT_FLAG_KEY = 'mock_initialized';

/**
 * Initializes localStorage with mock data if not already present.
 * Checks for an initialization flag to avoid overwriting existing data.
 * @returns {void}
 */
export function initializeMockData() {
  const isInitialized = getItem(INIT_FLAG_KEY, false);

  if (isInitialized) {
    return;
  }

  setItem('user', MOCK_USER);
  setItem('accounts', MOCK_ACCOUNTS);
  setItem('signers', MOCK_SIGNERS);
  setItem('esign_tokens', MOCK_ESIGN_TOKENS);
  setItem('otp_contacts', MOCK_OTP_CONTACTS);
  setItem('rate_limits', MOCK_RATE_LIMITS);
  setItem('audit_log', MOCK_AUDIT_LOG);
  setItem(INIT_FLAG_KEY, true);
}

/**
 * Resets all mock data in localStorage to initial values.
 * Useful for testing or resetting application state.
 * @returns {void}
 */
export function resetMockData() {
  setItem('user', MOCK_USER);
  setItem('accounts', MOCK_ACCOUNTS);
  setItem('signers', MOCK_SIGNERS);
  setItem('esign_tokens', MOCK_ESIGN_TOKENS);
  setItem('otp_contacts', MOCK_OTP_CONTACTS);
  setItem('rate_limits', MOCK_RATE_LIMITS);
  setItem('audit_log', MOCK_AUDIT_LOG);
  setItem(INIT_FLAG_KEY, true);
}