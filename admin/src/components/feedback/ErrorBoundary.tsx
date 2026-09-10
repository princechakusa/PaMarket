import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { failed: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };
  static getDerivedStateFromError(): State { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Mock shell render failed', error, info); }
  render() {
    if (this.state.failed) return <main className="standalone-state" role="alert"><p className="eyebrow">Preview error</p><h1>The mock shell could not render</h1><p>Reload the local preview. No production operation was attempted.</p></main>;
    return this.props.children;
  }
}
