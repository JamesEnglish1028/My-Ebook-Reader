import React from 'react';

import Spinner from '../Spinner';

type LoadingVariant = 'spinner' | 'skeleton' | 'inline' | 'page';
type LoadingSize = 'small' | 'medium' | 'large';

interface LoadingProps {
  /** Variant of loading indicator */
  variant?: LoadingVariant;
  /** Size of loading indicator */
  size?: LoadingSize;
  /** Optional loading message */
  message?: string;
  /** Additional class names */
  className?: string;
}

/**
 * Loading - Unified loading component for all async operations
 *
 * Provides consistent loading states across the application with multiple variants:
 * - spinner: Circular spinner (default)
 * - skeleton: Skeleton loader for content placeholders
 * - inline: Small inline loader for buttons/actions
 * - page: Full-page loading overlay
 *
 * @example
 * // Spinner variant (default)
 * <Loading message="Loading books..." />
 *
 * @example
 * // Skeleton for book grid
 * <Loading variant="skeleton" />
 *
 * @example
 * // Inline for button actions
 * <Loading variant="inline" size="small" />
 *
 * @example
 * // Full page loader
 * <Loading variant="page" message="Importing book..." />
 */
const Loading: React.FC<LoadingProps> = ({
  variant = 'spinner',
  size = 'medium',
  message,
  className = '',
}) => {
  // Spinner variant - uses existing Spinner component
  if (variant === 'spinner') {
    // Map 'large' to 'medium' for Spinner compatibility
    const spinnerSize = size === 'large' ? 'medium' : size;
    return (
      <div className={`flex justify-center items-center ${className}`}>
        <Spinner text={message} size={spinnerSize} />
      </div>
    );
  }

  // Inline variant - small loader for inline use
  if (variant === 'inline') {
    const sizeClasses = {
      small: 'w-4 h-4',
      medium: 'w-5 h-5',
      large: 'w-6 h-6',
    };

    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <svg
          className={`animate-spin ${sizeClasses[size]} text-sky-400`}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        {message && <span className="text-sm text-slate-300 theme-text-secondary">{message}</span>}
      </div>
    );
  }

  // Skeleton variant - loading placeholder
  if (variant === 'skeleton') {
    return (
      <div className={`animate-pulse ${className}`}>
        {/* Book grid skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
          {Array.from({ length: 12 }).map((_, index) => (
            <div key={index} className="space-y-3">
              {/* Book cover skeleton */}
              <div className="aspect-[2/3] bg-slate-700 rounded-lg theme-surface-elevated" />
              {/* Title skeleton */}
              <div className="h-4 bg-slate-700 rounded w-3/4 theme-surface-elevated" />
              {/* Author skeleton */}
              <div className="h-3 bg-slate-700 rounded w-1/2 theme-surface-elevated" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Page variant - full-page loading overlay
  if (variant === 'page') {
    // Map 'large' to 'medium' for Spinner compatibility
    const spinnerSize = size === 'large' ? 'medium' : size;
    return (
      <div className={`fixed inset-0 bg-slate-900 bg-opacity-75 flex items-center justify-center z-50 ${className}`}>
        <div className="bg-slate-800 p-8 rounded-lg shadow-xl text-center max-w-sm w-full border theme-surface-elevated theme-border theme-text-primary">
          <Spinner text={message} size={spinnerSize} />
        </div>
      </div>
    );
  }

  return null;
};

export default Loading;
