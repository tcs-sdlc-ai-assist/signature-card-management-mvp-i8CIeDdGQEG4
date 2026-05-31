/**
 * WorkflowContext for SIG Card Management.
 * Provides workflow state and navigation actions to all components via React context.
 * Manages the multi-step workflow progression:
 *   Welcome → Login → Verify Identity → Select Account → Manage Signers → Add/Edit Signer → Confirm Signers → Review → Submit
 * Integrates with AccountService, SignerService, and SubmissionService.
 * Persists workflow state to localStorage for resilience across page refreshes.
 */

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { WORKFLOW_STEPS, STEP_INDEX } from '../constants/constants.js';
import { getItem, setItem } from '../utils/storage.js';
import { getAccountById } from '../services/accountService.js';
import { getSigners } from '../services/signerService.js';
import { getStagedChanges, clearStagedChanges } from '../services/submissionService.js';

/** @type {string} Storage key for persisted workflow state */
const WORKFLOW_STATE_KEY = 'workflow_state';

/**
 * @typedef {Object} WorkflowContextValue
 * @property {number} currentStep - The current step index.
 * @property {string} currentStepName - The name of the current step.
 * @property {Array<number>} completedSteps - Array of completed step indices.
 * @property {Object|null} selectedAccount - The currently selected account.
 * @property {Array<Object>} signers - The signers for the selected account.
 * @property {Array<Object>} stagedChanges - The staged signer changes.
 * @property {Object|null} editingSigner - The signer currently being edited.
 * @property {boolean} canNavigateBack - Whether backward navigation is allowed.
 * @property {boolean} canNavigateForward - Whether forward navigation is allowed.
 * @property {Function} goForward - Advance to the next step.
 * @property {Function} goBack - Return to the previous step.
 * @property {Function} navigateToStep - Navigate to a specific step by index.
 * @property {Function} selectAccount - Select an account and advance.
 * @property {Function} setEditingSigner - Set the signer being edited.
 * @property {Function} clearEditingSigner - Clear the editing signer.
 * @property {Function} refreshSigners - Refresh the signers list for the selected account.
 * @property {Function} refreshStagedChanges - Refresh the staged changes list.
 * @property {Function} cancelWorkflow - Cancel and reset the workflow.
 * @property {Function} resetWorkflow - Reset the workflow to the initial state.
 * @property {Function} markStepCompleted - Mark a step as completed.
 * @property {Array<string>} steps - The list of workflow step names.
 */

const WorkflowContext = createContext(null);

/**
 * Custom hook to access the WorkflowContext.
 * Throws an error if used outside of WorkflowProvider.
 * @returns {WorkflowContextValue} The workflow context value.
 */
export function useWorkflow() {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error('useWorkflow must be used within a WorkflowProvider.');
  }
  return context;
}

/**
 * Returns the default workflow state.
 * @returns {Object} The default workflow state object.
 */
function getDefaultWorkflowState() {
  return {
    currentStep: STEP_INDEX.WELCOME,
    completedSteps: [],
    selectedAccountId: null,
  };
}

/**
 * Loads persisted workflow state from localStorage.
 * Falls back to default state if not found or invalid.
 * @returns {Object} The workflow state object.
 */
function loadWorkflowState() {
  const stored = getItem(WORKFLOW_STATE_KEY, null);

  if (!stored || typeof stored !== 'object') {
    return getDefaultWorkflowState();
  }

  return {
    currentStep: typeof stored.currentStep === 'number' && stored.currentStep >= 0 && stored.currentStep < WORKFLOW_STEPS.length
      ? stored.currentStep
      : STEP_INDEX.WELCOME,
    completedSteps: Array.isArray(stored.completedSteps)
      ? stored.completedSteps.filter((s) => typeof s === 'number' && s >= 0 && s < WORKFLOW_STEPS.length)
      : [],
    selectedAccountId: stored.selectedAccountId && typeof stored.selectedAccountId === 'string'
      ? stored.selectedAccountId
      : null,
  };
}

/**
 * Persists workflow state to localStorage.
 * @param {Object} state - The workflow state to persist.
 * @returns {boolean} True if saved successfully.
 */
function saveWorkflowState(state) {
  return setItem(WORKFLOW_STATE_KEY, {
    currentStep: state.currentStep,
    completedSteps: state.completedSteps,
    selectedAccountId: state.selectedAccountId,
  });
}

/**
 * WorkflowProvider component.
 * Wraps the application to provide workflow state and navigation actions to all child components.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components.
 * @returns {JSX.Element} The WorkflowProvider component.
 */
export function WorkflowProvider({ children }) {
  const [currentStep, setCurrentStep] = useState(() => {
    const state = loadWorkflowState();
    return state.currentStep;
  });

  const [completedSteps, setCompletedSteps] = useState(() => {
    const state = loadWorkflowState();
    return state.completedSteps;
  });

  const [selectedAccount, setSelectedAccount] = useState(null);
  const [selectedAccountId, setSelectedAccountId] = useState(() => {
    const state = loadWorkflowState();
    return state.selectedAccountId;
  });

  const [signers, setSigners] = useState([]);
  const [stagedChanges, setStagedChanges] = useState([]);
  const [editingSigner, setEditingSignerState] = useState(null);

  /**
   * Persist workflow state to localStorage whenever it changes.
   */
  useEffect(() => {
    saveWorkflowState({
      currentStep,
      completedSteps,
      selectedAccountId,
    });
  }, [currentStep, completedSteps, selectedAccountId]);

  /**
   * Load the selected account data when selectedAccountId changes.
   */
  useEffect(() => {
    if (selectedAccountId) {
      const result = getAccountById(selectedAccountId);
      if (result.success && result.account) {
        setSelectedAccount(result.account);
      } else {
        setSelectedAccount(null);
      }
    } else {
      setSelectedAccount(null);
    }
  }, [selectedAccountId]);

  /**
   * Load signers when the selected account changes.
   */
  useEffect(() => {
    if (selectedAccountId) {
      const result = getSigners(selectedAccountId);
      if (result.success) {
        setSigners(result.signers);
      } else {
        setSigners([]);
      }
    } else {
      setSigners([]);
    }
  }, [selectedAccountId]);

  /**
   * Load staged changes when the step changes to confirm or review.
   */
  useEffect(() => {
    if (
      currentStep === STEP_INDEX.CONFIRM_SIGNERS ||
      currentStep === STEP_INDEX.REVIEW
    ) {
      const result = getStagedChanges();
      if (result.success) {
        setStagedChanges(result.changes);
      } else {
        setStagedChanges([]);
      }
    }
  }, [currentStep]);

  /**
   * The name of the current workflow step.
   * @type {string}
   */
  const currentStepName = useMemo(() => {
    return WORKFLOW_STEPS[currentStep] || '';
  }, [currentStep]);

  /**
   * Whether backward navigation is allowed from the current step.
   * Cannot go back from Welcome or Submit.
   * @type {boolean}
   */
  const canNavigateBack = useMemo(() => {
    return currentStep > STEP_INDEX.WELCOME && currentStep < STEP_INDEX.SUBMIT;
  }, [currentStep]);

  /**
   * Whether forward navigation is allowed from the current step.
   * Can only go forward if the current step is completed.
   * @type {boolean}
   */
  const canNavigateForward = useMemo(() => {
    if (currentStep >= STEP_INDEX.SUBMIT) {
      return false;
    }
    return completedSteps.includes(currentStep);
  }, [currentStep, completedSteps]);

  /**
   * Marks a step as completed.
   * @param {number} stepIndex - The step index to mark as completed.
   * @returns {void}
   */
  const markStepCompleted = useCallback((stepIndex) => {
    if (typeof stepIndex !== 'number' || stepIndex < 0 || stepIndex >= WORKFLOW_STEPS.length) {
      return;
    }

    setCompletedSteps((prev) => {
      if (prev.includes(stepIndex)) {
        return prev;
      }
      return [...prev, stepIndex];
    });
  }, []);

  /**
   * Advances to the next step in the workflow.
   * Marks the current step as completed before advancing.
   * @returns {void}
   */
  const goForward = useCallback(() => {
    setCurrentStep((prev) => {
      if (prev >= WORKFLOW_STEPS.length - 1) {
        return prev;
      }

      const nextStep = prev + 1;

      setCompletedSteps((prevCompleted) => {
        if (prevCompleted.includes(prev)) {
          return prevCompleted;
        }
        return [...prevCompleted, prev];
      });

      return nextStep;
    });
  }, []);

  /**
   * Returns to the previous step in the workflow.
   * @returns {void}
   */
  const goBack = useCallback(() => {
    setCurrentStep((prev) => {
      if (prev <= STEP_INDEX.WELCOME) {
        return prev;
      }
      return prev - 1;
    });
  }, []);

  /**
   * Navigates to a specific step by index.
   * Only allows navigation to completed steps or the next available step.
   * @param {number} stepIndex - The step index to navigate to.
   * @returns {boolean} True if navigation was successful.
   */
  const navigateToStep = useCallback((stepIndex) => {
    if (typeof stepIndex !== 'number' || stepIndex < 0 || stepIndex >= WORKFLOW_STEPS.length) {
      return false;
    }

    // Allow navigation to any completed step or the current step
    if (stepIndex === currentStep) {
      return true;
    }

    // Allow navigation to completed steps
    if (completedSteps.includes(stepIndex)) {
      setCurrentStep(stepIndex);
      return true;
    }

    // Allow navigation to the next step after the current one if current is completed
    if (stepIndex === currentStep + 1 && completedSteps.includes(currentStep)) {
      setCurrentStep(stepIndex);
      return true;
    }

    return false;
  }, [currentStep, completedSteps]);

  /**
   * Selects an account and advances to the Manage Signers step.
   * @param {string} accountId - The account ID to select.
   * @returns {{ success: boolean, message: string }}
   */
  const selectAccount = useCallback((accountId) => {
    if (!accountId || typeof accountId !== 'string') {
      return { success: false, message: 'Account ID is required.' };
    }

    const trimmedId = accountId.trim();
    const result = getAccountById(trimmedId);

    if (!result.success || !result.account) {
      return { success: false, message: result.message || 'Account not found.' };
    }

    setSelectedAccountId(trimmedId);
    setSelectedAccount(result.account);

    // Load signers for the selected account
    const signersResult = getSigners(trimmedId);
    if (signersResult.success) {
      setSigners(signersResult.signers);
    } else {
      setSigners([]);
    }

    // Mark Select Account step as completed and advance
    markStepCompleted(STEP_INDEX.SELECT_ACCOUNT);
    setCurrentStep(STEP_INDEX.MANAGE_SIGNERS);

    return { success: true, message: 'Account selected successfully.' };
  }, [markStepCompleted]);

  /**
   * Sets the signer currently being edited.
   * @param {Object|null} signer - The signer object to edit, or null to clear.
   * @returns {void}
   */
  const setEditingSigner = useCallback((signer) => {
    setEditingSignerState(signer || null);

    if (signer) {
      setCurrentStep(STEP_INDEX.ADD_EDIT_SIGNER);
    }
  }, []);

  /**
   * Clears the editing signer and returns to Manage Signers.
   * @returns {void}
   */
  const clearEditingSigner = useCallback(() => {
    setEditingSignerState(null);
  }, []);

  /**
   * Refreshes the signers list for the currently selected account.
   * @returns {void}
   */
  const refreshSigners = useCallback(() => {
    if (!selectedAccountId) {
      setSigners([]);
      return;
    }

    const result = getSigners(selectedAccountId);
    if (result.success) {
      setSigners(result.signers);
    } else {
      setSigners([]);
    }
  }, [selectedAccountId]);

  /**
   * Refreshes the staged changes list.
   * @returns {void}
   */
  const refreshStagedChanges = useCallback(() => {
    const result = getStagedChanges();
    if (result.success) {
      setStagedChanges(result.changes);
    } else {
      setStagedChanges([]);
    }
  }, []);

  /**
   * Cancels the workflow and resets to the Welcome step.
   * Clears staged changes and selected account.
   * @returns {void}
   */
  const cancelWorkflow = useCallback(() => {
    clearStagedChanges();

    setCurrentStep(STEP_INDEX.WELCOME);
    setCompletedSteps([]);
    setSelectedAccount(null);
    setSelectedAccountId(null);
    setSigners([]);
    setStagedChanges([]);
    setEditingSignerState(null);

    saveWorkflowState(getDefaultWorkflowState());
  }, []);

  /**
   * Resets the workflow to the initial state.
   * @returns {void}
   */
  const resetWorkflow = useCallback(() => {
    clearStagedChanges();

    setCurrentStep(STEP_INDEX.WELCOME);
    setCompletedSteps([]);
    setSelectedAccount(null);
    setSelectedAccountId(null);
    setSigners([]);
    setStagedChanges([]);
    setEditingSignerState(null);

    saveWorkflowState(getDefaultWorkflowState());
  }, []);

  const value = useMemo(() => ({
    currentStep,
    currentStepName,
    completedSteps,
    selectedAccount,
    signers,
    stagedChanges,
    editingSigner,
    canNavigateBack,
    canNavigateForward,
    goForward,
    goBack,
    navigateToStep,
    selectAccount,
    setEditingSigner,
    clearEditingSigner,
    refreshSigners,
    refreshStagedChanges,
    cancelWorkflow,
    resetWorkflow,
    markStepCompleted,
    steps: WORKFLOW_STEPS,
  }), [
    currentStep,
    currentStepName,
    completedSteps,
    selectedAccount,
    signers,
    stagedChanges,
    editingSigner,
    canNavigateBack,
    canNavigateForward,
    goForward,
    goBack,
    navigateToStep,
    selectAccount,
    setEditingSigner,
    clearEditingSigner,
    refreshSigners,
    refreshStagedChanges,
    cancelWorkflow,
    resetWorkflow,
    markStepCompleted,
  ]);

  return (
    <WorkflowContext.Provider value={value}>
      {children}
    </WorkflowContext.Provider>
  );
}

WorkflowProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export default WorkflowContext;