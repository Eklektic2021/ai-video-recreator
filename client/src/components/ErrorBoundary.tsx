import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Unhandled render error:', error.message);
    console.error('[ErrorBoundary] Stack:', error.stack);
    console.error('[ErrorBoundary] Component stack:', info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="eb-overlay">
        <div className="eb-card">
          <h2 className="eb-title">Something went wrong</h2>
          <p className="eb-desc">
            An unexpected error crashed the page. This is usually caused by a malformed
            API response or a missing field in the analysis output.
          </p>
          <details className="eb-details">
            <summary className="eb-summary">Error details</summary>
            <pre className="eb-stack">{error.message}{'\n\n'}{error.stack}</pre>
          </details>
          <div className="eb-actions">
            <button className="eb-reload-btn" onClick={() => window.location.reload()}>
              Reload Page
            </button>
            <button
              className="eb-dismiss-btn"
              onClick={() => this.setState({ error: null })}
            >
              Try to Recover
            </button>
          </div>
        </div>
      </div>
    );
  }
}
