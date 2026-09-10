import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { failed: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };
  static getDerivedStateFromError(): State { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Admin shell render failed', error.name, info.componentStack); }
  render() {
    if (this.state.failed) return <main className="standalone-state" role="alert"><p className="eyebrow">Application error</p><h1>The admin shell could not render</h1><p>Reload the page. The error boundary does not log tokens, credentials, or request payloads.</p></main>;
    return this.props.children;
  }
}
