/**
 * AuthContext for SIG Card Management.
 * Provides authentication state and actions to all components via React context.
 * Integrates with AuthService, SessionManager, and IdentityVerificationService.
 * Handles session timeout monitoring with interval timer, warning modal trigger, and auto-logout.
 */

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  login as authLogin,
  logout as authLogout,
  getSession,
  isAuthenticated as checkIsAuthenticated,
  isIdentityVerified as checkIsVerified,
  updateSessionActivity,
  extendSession,
  invalidateSession,
} from '../services/authService.js';
import {
  isSessionExpired,
  isSessionWarning,
} from '../services/sessionManager.js';
import {
  generateOtp,
  verifyOtp,
  resendOtp,
  getDeliveryMethods,
  getVerificationStatus,
  resetVerification,
} from '../services/identityVerificationService.js';

/** @type {number} Interval in milliseconds for session monitoring (every 30 seconds) */
const SESSION_CHECK_INTERVAL_MS = 30000;

/**
 * @typedef {Object} AuthContextValue
 * @property {Object|null} currentUser - The current authenticated user info.
 * @property {Object|null} session - The current session object.
 * @property {boolean} isAuthenticated - Whether the user is authenticated.
 * @property {boolean} isVerified - Whether the user's identity has been verified.
 * @property {boolean} isLoading - Whether an auth operation is in progress.
 * @property {boolean} showSessionWarning - Whether the session timeout warning should be displayed.
 * @property {string|null} error - The last error message.
 * @property {Function} login - Login function.
 * @property {Function} logout - Logout function.
 * @property {Function} requestOtp - Request OTP function.
 * @property {Function} verifyIdentity - Verify OTP function.
 * @property {Function} resendOtpCode - Resend OTP function.
 * @property {Function} getOtpDeliveryMethods - Get delivery methods function.
 * @property {Function} getOtpStatus - Get verification status function.
 * @property {Function} extendCurrentSession - Extend session function.
 * @property {Function} clearError - Clear error function.
 * @property {Function} dismissSessionWarning - Dismiss session warning function.
 */

const AuthContext = createContext(null);

/**
 * Custom hook to access the AuthContext.
 * Throws an error if used outside of AuthProvider.
 * @returns {AuthContextValue} The authentication context value.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }
  return context;
}

/**
 * AuthProvider component.
 * Wraps the application to provide authentication state and actions to all child components.
 * Monitors session timeout and triggers warning/auto-logout.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components.
 * @returns {JSX.Element} The AuthProvider component.
 */
export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [session, setSession] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showSessionWarning, setShowSessionWarning] = useState(false);
  const [error, setError] = useState(null);

  const sessionCheckIntervalRef = useRef(null);

  /**
   * Refreshes the auth state from the current session in localStorage.
   * @returns {void}
   */
  const refreshAuthState = useCallback(() => {
    const currentSession = getSession();

    if (currentSession) {
      setSession(currentSession);
      setCurrentUser({
        userId: currentSession.userId,
        username: currentSession.username,
        firstName: currentSession.firstName,
        lastName: currentSession.lastName,
        role: currentSession.role,
      });
      setIsAuthenticated(currentSession.isAuthenticated === true);
      setIsVerified(currentSession.identityVerified === true);
    } else {
      setSession(null);
      setCurrentUser(null);
      setIsAuthenticated(false);
      setIsVerified(false);
    }
  }, []);

  /**
   * Initializes auth state on mount by checking for an existing session.
   */
  useEffect(() => {
    refreshAuthState();
    setIsLoading(false);
  }, [refreshAuthState]);

  /**
   * Monitors session timeout and triggers warning or auto-logout.
   */
  useEffect(() => {
    if (!isAuthenticated) {
      if (sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current);
        sessionCheckIntervalRef.current = null;
      }
      setShowSessionWarning(false);
      return;
    }

    sessionCheckIntervalRef.current = setInterval(() => {
      if (isSessionExpired()) {
        invalidateSession();
        setSession(null);
        setCurrentUser(null);
        setIsAuthenticated(false);
        setIsVerified(false);
        setShowSessionWarning(false);
        setError('Your session has expired due to inactivity. Please log in again.');
      } else if (isSessionWarning()) {
        setShowSessionWarning(true);
      } else {
        setShowSessionWarning(false);
      }
    }, SESSION_CHECK_INTERVAL_MS);

    return () => {
      if (sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current);
        sessionCheckIntervalRef.current = null;
      }
    };
  }, [isAuthenticated]);

  /**
   * Tracks user activity to reset session timeout.
   */
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    function handleActivity() {
      updateSessionActivity();
    }

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];

    for (let i = 0; i < events.length; i++) {
      window.addEventListener(events[i], handleActivity, { passive: true });
    }

    return () => {
      for (let i = 0; i < events.length; i++) {
        window.removeEventListener(events[i], handleActivity);
      }
    };
  }, [isAuthenticated]);

  /**
   * Authenticates a user with the provided credentials.
   * @param {string} username - The username.
   * @param {string} password - The password.
   * @returns {{ success: boolean, message: string, remainingAttempts: number|null }}
   */
  const login = useCallback(async (username, password) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = authLogin(username, password);

      if (result.success) {
        setSession(result.session);
        setCurrentUser({
          userId: result.session.userId,
          username: result.session.username,
          firstName: result.session.firstName,
          lastName: result.session.lastName,
          role: result.session.role,
        });
        setIsAuthenticated(true);
        setIsVerified(false);
      } else {
        setError(result.message);
      }

      setIsLoading(false);
      return {
        success: result.success,
        message: result.message,
        remainingAttempts: result.remainingAttempts,
      };
    } catch (err) {
      const message = 'An unexpected error occurred during login. Please try again.';
      setError(message);
      setIsLoading(false);
      return {
        success: false,
        message: message,
        remainingAttempts: null,
      };
    }
  }, []);

  /**
   * Logs out the current user and clears all auth state.
   * @returns {{ success: boolean, message: string }}
   */
  const logout = useCallback(() => {
    try {
      resetVerification();
      const result = authLogout();

      setSession(null);
      setCurrentUser(null);
      setIsAuthenticated(false);
      setIsVerified(false);
      setShowSessionWarning(false);
      setError(null);

      return result;
    } catch (err) {
      setSession(null);
      setCurrentUser(null);
      setIsAuthenticated(false);
      setIsVerified(false);
      setShowSessionWarning(false);

      return {
        success: true,
        message: 'Logged out.',
      };
    }
  }, []);

  /**
   * Requests an OTP to be sent via the specified delivery method.
   * @param {string} deliveryMethod - The delivery method ('sms' or 'email').
   * @returns {{ success: boolean, message: string, otp: string|null, expiresAt: string|null }}
   */
  const requestOtp = useCallback((deliveryMethod) => {
    setError(null);

    try {
      const result = generateOtp(deliveryMethod);

      if (!result.success) {
        setError(result.message);
      }

      return result;
    } catch (err) {
      const message = 'An unexpected error occurred while requesting OTP. Please try again.';
      setError(message);
      return {
        success: false,
        message: message,
        otp: null,
        expiresAt: null,
      };
    }
  }, []);

  /**
   * Verifies the provided OTP code.
   * @param {string} code - The 6-digit OTP code.
   * @returns {{ success: boolean, message: string, remainingAttempts: number|null }}
   */
  const verifyIdentity = useCallback((code) => {
    setError(null);

    try {
      const result = verifyOtp(code);

      if (result.success) {
        setIsVerified(true);
        refreshAuthState();
      } else {
        setError(result.message);
      }

      return result;
    } catch (err) {
      const message = 'An unexpected error occurred during verification. Please try again.';
      setError(message);
      return {
        success: false,
        message: message,
        remainingAttempts: null,
      };
    }
  }, [refreshAuthState]);

  /**
   * Resends the OTP via the specified delivery method.
   * @param {string} deliveryMethod - The delivery method ('sms' or 'email').
   * @returns {{ success: boolean, message: string, otp: string|null, expiresAt: string|null, remainingResends: number|null }}
   */
  const resendOtpCode = useCallback((deliveryMethod) => {
    setError(null);

    try {
      const result = resendOtp(deliveryMethod);

      if (!result.success) {
        setError(result.message);
      }

      return result;
    } catch (err) {
      const message = 'An unexpected error occurred while resending OTP. Please try again.';
      setError(message);
      return {
        success: false,
        message: message,
        otp: null,
        expiresAt: null,
        remainingResends: null,
      };
    }
  }, []);

  /**
   * Returns the available OTP delivery methods.
   * @returns {Array<Object>} An array of delivery method objects.
   */
  const getOtpDeliveryMethods = useCallback(() => {
    try {
      return getDeliveryMethods();
    } catch (err) {
      return [];
    }
  }, []);

  /**
   * Returns the current OTP verification status.
   * @returns {{ hasOtp: boolean, isVerified: boolean, isExpired: boolean, attemptsUsed: number, resendsUsed: number }}
   */
  const getOtpStatus = useCallback(() => {
    try {
      return getVerificationStatus();
    } catch (err) {
      return {
        hasOtp: false,
        isVerified: false,
        isExpired: false,
        attemptsUsed: 0,
        resendsUsed: 0,
      };
    }
  }, []);

  /**
   * Extends the current session to prevent timeout.
   * @returns {boolean} True if the session was extended.
   */
  const extendCurrentSession = useCallback(() => {
    try {
      const result = extendSession();

      if (result) {
        setShowSessionWarning(false);
        refreshAuthState();
      }

      return result;
    } catch (err) {
      return false;
    }
  }, [refreshAuthState]);

  /**
   * Clears the current error message.
   * @returns {void}
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Dismisses the session timeout warning.
   * @returns {void}
   */
  const dismissSessionWarning = useCallback(() => {
    setShowSessionWarning(false);
  }, []);

  const value = {
    currentUser,
    session,
    isAuthenticated,
    isVerified,
    isLoading,
    showSessionWarning,
    error,
    login,
    logout,
    requestOtp,
    verifyIdentity,
    resendOtpCode,
    getOtpDeliveryMethods,
    getOtpStatus,
    extendCurrentSession,
    clearError,
    dismissSessionWarning,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export default AuthContext;