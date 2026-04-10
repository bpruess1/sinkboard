import React, { Component, type ReactNode, type ErrorInfo } from 'react';
import * as Sentry from '@sentry/react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, errorInfo: ErrorInfo, reset: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  section?: 'game' | 'tasks' | 'auth' | 'app';
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    // Track error with Sentry
    if (typeof window !== 'undefined' && Sentry) {
      Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
            section: this.props.section || 'unknown',
          },
        },
      });
    }

    // Call custom error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
  }

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.state.errorInfo!, this.resetError);
      }

      return (
        <DefaultErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          reset={this.resetError}
          section={this.props.section}
        />
      );
    }

    return this.props.children;
  }
}

interface DefaultErrorFallbackProps {
  error: Error;
  errorInfo: ErrorInfo | null;
  reset: () => void;
  section?: string;
}

function DefaultErrorFallback({ error, errorInfo, reset, section }: DefaultErrorFallbackProps): JSX.Element {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    minHeight: '300px',
    backgroundColor: '#1a1a2e',
    color: '#e0e0e0',
    borderRadius: '8px',
    margin: '1rem',
  };

  const headingStyle: React.CSSProperties = {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    marginBottom: '1rem',
    color: '#ff6b6b',
  };

  const messageStyle: React.CSSProperties = {
    fontSize: '1rem',
    marginBottom: '1.5rem',
    textAlign: 'center',
    maxWidth: '500px',
  };

  const buttonStyle: React.CSSProperties = {
    padding: '0.75rem 1.5rem',
    fontSize: '1rem',
    backgroundColor: '#4a90e2',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    marginBottom: '1rem',
  };

  const detailsStyle: React.CSSProperties = {
    marginTop: '1rem',
    padding: '1rem',
    backgroundColor: '#16213e',
    borderRadius: '4px',
    maxWidth: '600px',
    width: '100%',
    fontSize: '0.875rem',
    fontFamily: 'monospace',
    overflow: 'auto',
    maxHeight: '200px',
  };

  const getSectionMessage = (): string => {
    switch (section) {
      case 'game':
        return 'The game scene encountered an error. Your progress is saved.';
      case 'tasks':
        return 'The task list encountered an error. Try refreshing to reload your tasks.';
      case 'auth':
        return 'Authentication error occurred. You may need to sign in again.';
      default:
        return 'Something went wrong. Please try again.';
    }
  };

  return (
    <div style={containerStyle}>
      <h2 style={headingStyle}>Oops! Something went wrong</h2>
      <p style={messageStyle}>{getSectionMessage()}</p>
      <button style={buttonStyle} onClick={reset}>
        Try Again
      </button>
      {process.env.NODE_ENV === 'development' && (
        <details style={detailsStyle}>
          <summary style={{ cursor: 'pointer', marginBottom: '0.5rem' }}>Error Details</summary>
          <div>
            <strong>Error:</strong> {error.toString()}
          </div>
          {errorInfo && (
            <div style={{ marginTop: '0.5rem' }}>
              <strong>Component Stack:</strong>
              <pre style={{ whiteSpace: 'pre-wrap', marginTop: '0.25rem' }}>
                {errorInfo.componentStack}
              </pre>
            </div>
          )}
        </details>
      )}
    </div>
  );
}

export default ErrorBoundary;
