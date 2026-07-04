import React from 'react';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from '../ErrorBoundary';

function Bomb() {
  throw new Error('Simulated render crash');
}

describe('ErrorBoundary', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    // React logs the caught error to console.error by default (in addition to
    // our own componentDidCatch log) — silence it so the test output stays clean.
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test('renders children normally when nothing throws', () => {
    render(
      <ErrorBoundary>
        <div>Safe content</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('Safe content')).toBeInTheDocument();
  });

  test('catches a render error and shows the fallback UI instead of crashing the whole page', () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Reload Page')).toBeInTheDocument();
    expect(screen.getByText('Go Home')).toBeInTheDocument();
    // The crashed child's content must not be present.
    expect(screen.queryByText('Safe content')).not.toBeInTheDocument();
  });

  test('logs the caught error for diagnostics', () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );
    const loggedOurMessage = consoleErrorSpy.mock.calls.some(
      call => typeof call[0] === 'string' && call[0].includes('[ErrorBoundary]')
    );
    expect(loggedOurMessage).toBe(true);
  });
});
