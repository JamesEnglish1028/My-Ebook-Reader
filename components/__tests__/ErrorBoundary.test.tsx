
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ErrorBoundary from '../ErrorBoundary';

const ProblemChild = () => {
  throw new Error('Test error');
  // unreachable, but needed for JSX signature
  // eslint-disable-next-line no-unreachable
  return <div />;
};

const ChunkProblemChild = () => {
  throw new TypeError('error loading dynamically imported module: https://example.com/assets/chunk.js');
  // eslint-disable-next-line no-unreachable
  return <div />;
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('renders fallback UI when child throws', () => {
    const onReset = vi.fn();
    render(
      <ErrorBoundary onReset={onReset}>
        <ProblemChild />
      </ErrorBoundary>,
    );
    // Update to match actual fallback UI text and error message
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByText(/test error/i)).toBeInTheDocument();
    // Button text may be 'Try Again' or similar
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('renders children when no error', () => {
    const onReset = vi.fn();
    render(
      <ErrorBoundary onReset={onReset}>
        <div>Safe Child</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText('Safe Child')).toBeInTheDocument();
  });

  it('calls onReset and resets when Try Again is clicked', () => {
    const onReset = vi.fn();
    render(
      <ErrorBoundary onReset={onReset}>
        <ProblemChild />
      </ErrorBoundary>,
    );
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    const tryAgainButton = screen.getByRole('button', { name: /try again/i });
    fireEvent.click(tryAgainButton);
    expect(onReset).toHaveBeenCalled();
  });

  it('reloads once when a lazy chunk fails to load', () => {
    const onReset = vi.fn();

    render(
      <ErrorBoundary onReset={onReset}>
        <ChunkProblemChild />
      </ErrorBoundary>,
    );

    expect(window.sessionStorage.getItem('mebooks:chunk-reload-at')).toBeTruthy();
  });
});
