import React from 'react';
// Reuses NotFound's existing visual language (gradient card, teal/purple accent
// circles) rather than inventing a new error-page design — this is a fallback
// for uncaught render errors / failed lazy-chunk loads, not a new screen to
// design from scratch.
import '../pages/NotFound.css';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Server-side error reporting could hook in here later; for now this is
    // the one place an otherwise-blank white screen becomes a visible,
    // recoverable error state instead.
    console.error('[ErrorBoundary] Uncaught render error:', error, info?.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="nf-root">
        <div className="nf-bg-circle nf-bg-c1" />
        <div className="nf-bg-circle nf-bg-c2" />

        <div className="nf-card">
          <div className="nf-logo">StyleAI</div>

          <h1 className="nf-title">Something went wrong</h1>
          <p className="nf-desc">
            An unexpected error occurred while loading this page. Reloading usually
            fixes it — if it keeps happening, please let us know what you were doing.
          </p>

          {/* Plain <a>, not react-router's <Link> — if something in the app's own
              context tree is what threw, we can't rely on the router still working. */}
          <div className="nf-actions">
            <a href="/" className="nf-btn nf-btn-secondary">Go Home</a>
            <button className="nf-btn nf-btn-primary" onClick={this.handleReload}>Reload Page</button>
          </div>
        </div>
      </div>
    );
  }
}
