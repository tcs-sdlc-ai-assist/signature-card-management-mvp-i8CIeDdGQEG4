/**
 * ProgressIndicator component for SIG Card Management.
 * Displays a step-based progress indicator showing all workflow steps
 * with current step highlighted, completed steps marked, and future steps disabled.
 * Uses HB CSS classes for styling. Consumes WorkflowContext for current/completed step state.
 * Supports click navigation to completed steps only.
 * Accessible with ARIA attributes (aria-current, aria-label).
 *
 * @module ProgressIndicator
 * @see WorkflowContext
 * @user-story SCRUM-8964
 */

import { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useWorkflow } from '../context/WorkflowContext.jsx';
import { classNames } from '../utils/helpers.js';

/**
 * Returns the appropriate CSS class for a step based on its state.
 * @param {boolean} isCurrent - Whether this is the current step.
 * @param {boolean} isCompleted - Whether this step has been completed.
 * @returns {string} The CSS class string for the step.
 */
function getStepClassName(isCurrent, isCompleted) {
  if (isCurrent) {
    return 'progress-step progress-step--current';
  }
  if (isCompleted) {
    return 'progress-step progress-step--completed';
  }
  return 'progress-step progress-step--disabled';
}

/**
 * ProgressIndicator component.
 * Renders a horizontal step-based progress bar reflecting the current workflow state.
 * Completed steps are clickable for navigation; future steps are disabled.
 *
 * @param {Object} [props] - Component props.
 * @param {string} [props.className] - Additional CSS class names to apply to the container.
 * @returns {JSX.Element} The ProgressIndicator component.
 */
export function ProgressIndicator({ className }) {
  const {
    currentStep,
    completedSteps,
    steps,
    navigateToStep,
  } = useWorkflow();

  /**
   * Handles click on a step. Only navigates if the step is completed.
   * @param {number} stepIndex - The index of the clicked step.
   * @returns {void}
   */
  const handleStepClick = useCallback((stepIndex) => {
    if (completedSteps.includes(stepIndex) && stepIndex !== currentStep) {
      navigateToStep(stepIndex);
    }
  }, [completedSteps, currentStep, navigateToStep]);

  /**
   * Handles keyboard interaction on a step.
   * Activates on Enter or Space key press.
   * @param {React.KeyboardEvent} event - The keyboard event.
   * @param {number} stepIndex - The index of the step.
   * @returns {void}
   */
  const handleStepKeyDown = useCallback((event, stepIndex) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleStepClick(stepIndex);
    }
  }, [handleStepClick]);

  /**
   * Memoized step data with computed state for each step.
   * @type {Array<Object>}
   */
  const stepData = useMemo(() => {
    return steps.map((stepName, index) => {
      const isCurrent = index === currentStep;
      const isCompleted = completedSteps.includes(index);
      const isClickable = isCompleted && !isCurrent;

      return {
        index,
        name: stepName,
        isCurrent,
        isCompleted,
        isClickable,
        className: getStepClassName(isCurrent, isCompleted),
      };
    });
  }, [steps, currentStep, completedSteps]);

  const containerClassName = classNames('progress-indicator', className);

  return (
    <nav
      className={containerClassName}
      aria-label="Workflow progress"
      role="navigation"
    >
      <ol
        className="progress-indicator__list"
        style={{
          display: 'flex',
          listStyle: 'none',
          padding: 0,
          margin: 0,
          width: '100%',
          alignItems: 'center',
        }}
      >
        {stepData.map((step) => {
          const stepNumber = step.index + 1;
          let ariaLabel = `Step ${stepNumber}: ${step.name}`;
          if (step.isCompleted && !step.isCurrent) {
            ariaLabel += ' (completed)';
          } else if (step.isCurrent) {
            ariaLabel += ' (current)';
          } else {
            ariaLabel += ' (not started)';
          }

          return (
            <li
              key={step.index}
              className={step.className}
              style={{
                flex: '1 1 0',
                textAlign: 'center',
                position: 'relative',
              }}
            >
              <div
                role={step.isClickable ? 'button' : undefined}
                tabIndex={step.isClickable ? 0 : -1}
                aria-current={step.isCurrent ? 'step' : undefined}
                aria-label={ariaLabel}
                aria-disabled={!step.isClickable ? 'true' : undefined}
                onClick={step.isClickable ? () => handleStepClick(step.index) : undefined}
                onKeyDown={step.isClickable ? (e) => handleStepKeyDown(e, step.index) : undefined}
                className={classNames(
                  'progress-step__content',
                  { 'progress-step__content--clickable': step.isClickable }
                )}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  cursor: step.isClickable ? 'pointer' : 'default',
                  opacity: !step.isCurrent && !step.isCompleted ? 0.5 : 1,
                  padding: '0.5rem 0.25rem',
                }}
              >
                <span
                  className={classNames(
                    'progress-step__marker',
                    {
                      'hb-bg-primary': step.isCurrent,
                      'hb-bg-success': step.isCompleted && !step.isCurrent,
                    }
                  )}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '2rem',
                    height: '2rem',
                    borderRadius: '50%',
                    backgroundColor: step.isCurrent
                      ? '#1a73e8'
                      : step.isCompleted
                        ? '#34a853'
                        : '#c0c0c0',
                    color: '#ffffff',
                    fontWeight: 500,
                    fontSize: '0.875rem',
                    marginBottom: '0.25rem',
                  }}
                  aria-hidden="true"
                >
                  {step.isCompleted && !step.isCurrent ? '✓' : stepNumber}
                </span>
                <span
                  className="progress-step__label"
                  style={{
                    fontSize: '0.75rem',
                    lineHeight: '1.2',
                    fontWeight: step.isCurrent ? 500 : 400,
                    color: step.isCurrent
                      ? '#1a73e8'
                      : step.isCompleted
                        ? '#292929'
                        : '#757575',
                    maxWidth: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {step.name}
                </span>
              </div>
              {step.index < steps.length - 1 && (
                <div
                  className="progress-step__connector"
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    top: '1.25rem',
                    left: '50%',
                    width: '100%',
                    height: '2px',
                    backgroundColor: step.isCompleted ? '#34a853' : '#c0c0c0',
                    zIndex: 0,
                  }}
                />
              )}
            </li>
          );
        })}
      </ol>
      <div className="sr-only" aria-live="polite">
        {`Step ${currentStep + 1} of ${steps.length}: ${steps[currentStep]}`}
      </div>
    </nav>
  );
}

ProgressIndicator.propTypes = {
  className: PropTypes.string,
};

ProgressIndicator.defaultProps = {
  className: '',
};

export default ProgressIndicator;