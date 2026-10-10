import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Contains a render-time crash to one section of the UI.
 *
 * Without this, a single bad reading (the `null.toFixed()` crash) unmounts the
 * entire React tree and the page goes blank. Wrapping each dashboard panel
 * means a malformed field costs one card, not the whole dashboard.
 *
 * Resetting is driven by `resetKeys`: when the selected zone or a new poll
 * arrives, the boundary clears itself and retries the render, so recovery does
 * not need a page reload.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(prevProps) {
    const { resetKeys } = this.props;
    if (!this.state.error || !resetKeys) return;

    const prevKeys = prevProps.resetKeys || [];
    const changed =
      prevKeys.length !== resetKeys.length ||
      resetKeys.some((key, index) => !Object.is(key, prevKeys[index]));

    if (changed) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error, info) {
    // Kept in the console so the real stack is still available in production.
    console.error(`[AeroSense] "${this.props.label || 'section'}" failed to render:`, error, info);
    if (this.props.onError) this.props.onError(error, info);
  }

  handleRetry = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const { label = 'This section', compact = false } = this.props;

    return (
      <div
        role="alert"
        className={`rounded-2xl border border-amber-400/50 bg-amber-500/10 text-amber-900 dark:text-amber-200 ${
          compact ? 'p-3' : 'p-5'
        } flex items-start gap-3`}
      >
        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
        <div className="min-w-0 flex-1">
          <p className="font-extrabold text-xs uppercase tracking-wide">{label} could not be displayed</p>
          <p className="text-xs mt-1 leading-relaxed">
            A value in this panel was not in the expected format. The rest of the dashboard is unaffected, and
            no reading has been substituted.
          </p>
          <p className="text-[10px] font-mono mt-1.5 opacity-70 break-words">{String(error?.message || error)}</p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] active:scale-95 transition"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Try again</span>
          </button>
        </div>
      </div>
    );
  }
}
