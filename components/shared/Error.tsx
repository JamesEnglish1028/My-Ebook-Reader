import React from 'react';

type ErrorVariant = 'inline' | 'card' | 'page';
type ErrorSeverity = 'error' | 'warning' | 'info';

interface ErrorProps {
  /** Error message to display */
  message: string;
  /** Optional error title */
  title?: string;
  /** Display variant */
  variant?: ErrorVariant;
  /** Error severity level */
  severity?: ErrorSeverity;
  /** Optional retry callback */
  onRetry?: () => void;
  /** Optional dismiss callback */
  onDismiss?: () => void;
  /** Additional class names */
  className?: string;
}

/**
 * Error - Unified error component for all error states
 *
 * Provides consistent error display across the application with multiple variants:
 * - inline: Compact inline error message
 * - card: Card-style error with optional actions
 * - page: Full-page error display (default)
 *
 * Supports different severity levels (error, warning, info) with appropriate styling.
 *
 * @example
 * // Page error with retry
 * <Error
 *   title="Failed to Load Books"
 *   message="Could not connect to the library database."
 *   onRetry={() => refetch()}
 * />
 *
 * @example
 * // Inline warning
 * <Error
 *   variant="inline"
 *   severity="warning"
 *   message="Some books failed to sync"
 * />
 *
 * @example
 * // Card error with dismiss
 * <Error
 *   variant="card"
 *   title="Import Failed"
 *   message="The file format is not supported."
 *   onDismiss={() => setError(null)}
 * />
 */
const Error: React.FC<ErrorProps> = ({
  message,
  title,
  variant = 'page',
  severity = 'error',
  onRetry,
  onDismiss,
  className = '',
}) => {
  // Get severity colors
  const getSeverityColors = () => {
    switch (severity) {
      case 'error':
        return {
          bg: 'bg-red-900/20',
          border: 'border-red-500/50',
          text: 'text-red-400',
          icon: 'text-red-500',
          button: 'bg-red-600 hover:bg-red-700',
        };
      case 'warning':
        return {
          bg: 'bg-yellow-900/20',
          border: 'border-yellow-500/50',
          text: 'text-yellow-400',
          icon: 'text-yellow-500',
          button: 'bg-yellow-600 hover:bg-yellow-700',
        };
      case 'info':
        return {
          bg: 'bg-blue-900/20',
          border: 'border-blue-500/50',
          text: 'text-blue-400',
          icon: 'text-blue-500',
          button: 'bg-blue-600 hover:bg-blue-700',
        };
    }
  };

  const colors = getSeverityColors();

  // Get severity icon
  const getSeverityIcon = () => {
    switch (severity) {
      case 'error':
        return (
          <svg className={`w-6 h-6 ${colors.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'warning':
        return (
          <svg className={`w-6 h-6 ${colors.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      case 'info':
        return (
          <svg className={`w-6 h-6 ${colors.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  // Inline variant - compact message
  if (variant === 'inline') {
    return (
      <div className={`flex items-center gap-2 p-2 rounded ${colors.bg} ${colors.border} border ${className}`}>
        {getSeverityIcon()}
        <span className={`text-sm ${colors.text}`}>{message}</span>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="ml-auto text-slate-400 hover:text-white theme-text-muted"
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    );
  }

  // Card variant - card-style error
  if (variant === 'card') {
    return (
      <div className={`rounded-lg p-6 ${colors.bg} ${colors.border} border ${className}`}>
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">{getSeverityIcon()}</div>
          <div className="flex-1 min-w-0">
            {title && (
              <h3 className={`text-lg font-semibold mb-2 ${colors.text}`}>
                {title}
              </h3>
            )}
            <p className="text-slate-300 text-sm theme-text-secondary">{message}</p>

            {/* Actions */}
            {(onRetry || onDismiss) && (
              <div className="flex gap-3 mt-4">
                {onRetry && (
                  <button
                    onClick={onRetry}
                    className={`px-4 py-2 rounded-lg text-white font-medium transition-colors ${colors.button}`}
                  >
                    Try Again
                  </button>
                )}
                {onDismiss && (
                  <button
                    onClick={onDismiss}
                    className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors theme-button-neutral theme-hover-surface"
                  >
                    Dismiss
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Close button */}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="flex-shrink-0 text-slate-400 hover:text-white theme-text-muted"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    );
  }

  // Page variant - full-page error (default)
  return (
    <div className={`text-center py-20 ${colors.bg} rounded-lg ${className}`}>
      <div className="flex flex-col items-center max-w-md mx-auto">
        <div className="mb-4">{getSeverityIcon()}</div>

        <h2 className={`text-2xl font-semibold mb-2 ${colors.text}`}>
          {title || 'Something Went Wrong'}
        </h2>

        <p className="text-slate-300 mb-6 theme-text-secondary">
          {message}
        </p>

        {/* Actions */}
        {(onRetry || onDismiss) && (
          <div className="flex gap-3">
            {onRetry && (
              <button
                onClick={onRetry}
                className={`px-6 py-3 rounded-lg text-white font-bold transition-colors ${colors.button}`}
              >
                Try Again
              </button>
            )}
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="px-6 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold transition-colors theme-button-neutral theme-hover-surface"
              >
                Dismiss
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Error;
