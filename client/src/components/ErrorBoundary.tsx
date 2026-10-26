import { Component, ReactNode } from 'react';

/** Catches rendering errors so a bug shows a friendly screen instead of a blank page. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { console.error('UI error', error); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="card"><h1>Something went wrong</h1>
        <p className="muted">The game screen hit an unexpected error. Reloading usually fixes it, and you will rejoin your room automatically.</p>
        <button onClick={() => location.reload()}>Reload</button></main>
    );
  }
}
