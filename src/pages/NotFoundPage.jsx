/**
 * NotFoundPage component for SIG Card Management.
 * 404 Not Found page displayed for unmatched routes.
 * Shows a friendly error message and a link to return to the welcome screen.
 * Uses HB CSS styling classes.
 *
 * @module NotFoundPage
 * @user-story SCRUM-8965
 */

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * NotFoundPage component.
 * Renders a 404 error page with a friendly message and a button
 * to navigate back to the welcome/home screen.
 *
 * @returns {JSX.Element} The NotFoundPage component.
 */
export default function NotFoundPage() {
  const navigate = useNavigate();

  /**
   * Handles the "Go to Home" button click.
   * Navigates the user back to the welcome screen.
   * @returns {void}
   */
  const handleGoHome = useCallback(() => {
    navigate('/', { replace: true });
  }, [navigate]);

  /**
   * Handles keyboard interaction on the home button.
   * Activates on Enter or Space key press.
   * @param {React.KeyboardEvent} event - The keyboard event.
   * @returns {void}
   */
  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      navigate('/', { replace: true });
    }
  }, [navigate]);

  return (
    <main
      className="not-found-page"
      role="main"
      aria-labelledby="not-found-title"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '80vh',
        padding: '2rem 1.5rem',
        textAlign: 'center',
      }}
    >
      <div
        className="not-found-page__content hb-card"
        style={{
          maxWidth: '540px',
          width: '100%',
          padding: '3rem 2rem',
          borderRadius: '8px',
          backgroundColor: '#ffffff',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        }}
      >
        <span
          className="not-found-page__icon"
          aria-hidden="true"
          style={{
            display: 'block',
            fontSize: '4rem',
            lineHeight: 1,
            marginBottom: '1rem',
            color: '#757575',
          }}
        >
          404
        </span>
        <h1
          id="not-found-title"
          className="not-found-page__title"
          style={{
            fontSize: '1.75rem',
            fontWeight: 500,
            color: '#292929',
            marginBottom: '0.75rem',
            lineHeight: 1.3,
          }}
        >
          Page Not Found
        </h1>
        <p
          className="not-found-page__message"
          style={{
            fontSize: '0.9375rem',
            lineHeight: 1.5,
            color: '#555555',
            marginBottom: '2rem',
          }}
        >
          The page you are looking for does not exist or has been moved.
          Please check the URL or return to the home page.
        </p>
        <button
          type="button"
          className="hb-btn hb-btn-primary not-found-page__home-btn"
          onClick={handleGoHome}
          onKeyDown={handleKeyDown}
          aria-label="Return to home page"
          style={{
            display: 'inline-block',
            padding: '0.625rem 1.5rem',
            fontSize: '0.9375rem',
            fontWeight: 500,
            borderRadius: '4px',
            border: 'none',
            backgroundColor: '#1a73e8',
            color: '#ffffff',
            cursor: 'pointer',
            lineHeight: 1.5,
          }}
        >
          Go to Home
        </button>
      </div>
    </main>
  );
}