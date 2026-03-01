import type { ErrorInfo, ReactNode } from 'react';
import React, { Component } from 'react';

interface Props {
  children: ReactNode;
  onReset: () => void;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  // FIX: Replaced constructor with a class property for state initialization
  // and converted handleReset to an arrow function to avoid binding `this`.
  // This modern syntax resolves issues where `this.props` and `this.state` were
  // not being correctly recognized by the TypeScript compiler.
  state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReset = () => {
    this.props.onReset();
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="theme-shell theme-text-primary flex min-h-screen flex-col items-center justify-center p-4 text-center" role="alert">
          <div className="theme-surface-elevated theme-border theme-text-primary w-full max-w-lg rounded-lg border p-8 shadow-xl">
            <svg className="w-16 h-16 mx-auto text-red-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h1 className="text-2xl font-bold text-red-300">Something went wrong.</h1>
            <p className="theme-text-secondary mt-2">
              {this.props.fallbackMessage || 'An unexpected error occurred. Please try again.'}
            </p>
            {this.state.error && (
                 <details className="theme-surface theme-text-secondary mt-4 rounded-md p-3 text-left text-sm">
                    <summary className="theme-text-secondary cursor-pointer hover:text-sky-400">Error Details</summary>
                    <pre className="theme-text-muted mt-2 whitespace-pre-wrap break-all">
                        <code>{this.state.error.message}</code>
                    </pre>
                </details>
            )}
            <button
              onClick={this.handleReset}
              className="mt-6 py-2 px-6 rounded-md bg-sky-500 hover:bg-sky-600 transition-colors font-bold"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
