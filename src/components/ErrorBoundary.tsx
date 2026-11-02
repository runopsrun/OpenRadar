import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Last-resort boundary for render-time failures. The map and its data are
 * optional; a React crash should still leave the user with a reload path.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("OpenRadar render error", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="error-boundary">
        <div className="error-boundary__card">
          <p className="error-boundary__eyebrow">Unexpected error</p>
          <h1>OpenRadar hit a problem</h1>
          <p>
            The interface stopped unexpectedly. Reloading usually restores the
            map and your saved settings.
          </p>
          <pre>{this.state.error.message}</pre>
          <div className="error-boundary__actions">
            <button
              type="button"
              className="button button--primary"
              onClick={() => window.location.reload()}
            >
              Reload OpenRadar
            </button>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => this.setState({ error: null })}
            >
              Try to continue
            </button>
          </div>
        </div>
      </div>
    );
  }
}
