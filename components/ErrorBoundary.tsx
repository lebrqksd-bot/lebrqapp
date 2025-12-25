import React from 'react';

type Props = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

type State = {
  error: Error | null;
  info: React.ErrorInfo | null;
};

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): State {
    return { error, info: null };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ error, info });
    // Log with component stack for easier debugging in production builds
    console.error('[ErrorBoundary] Caught error', {
      message: error.message,
      name: error.name,
      stack: error.stack,
      componentStack: info?.componentStack,
    });
  }

  handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    const { error, info } = this.state;
    const { children, fallback } = this.props;

    if (error) {
      if (fallback) return fallback;
      return (
        <div style={{ padding: 16 }}>
          <h2>Something went wrong.</h2>
          <p>{error.message}</p>
          {info?.componentStack ? (
            <pre style={{ whiteSpace: 'pre-wrap', background: '#f6f8fa', padding: 12 }}>
              {info.componentStack}
            </pre>
          ) : null}
          <button onClick={this.handleReload} style={{ marginTop: 8 }}>Reload</button>
        </div>
      );
    }
    return children as React.ReactElement;
  }
}
