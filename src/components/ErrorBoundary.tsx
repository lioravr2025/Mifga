import { Component, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { logClientError } from "../lib/errorLogger";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/** Catches render-time crashes anywhere below it - without this, a thrown error unmounts the whole React tree and leaves a blank white screen with no way to recover or know what happened. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    logClientError(error.message, { stack: error.stack, context: { componentStack: info.componentStack } });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-bg text-center px-8">
          <p className="text-lg font-bold text-neutral-50">משהו השתבש</p>
          <p className="text-sm text-neutral-400 leading-relaxed">התקלה תועדה אצלנו. נסו לרענן את האפליקציה.</p>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-brand text-white font-semibold text-sm active:scale-95 transition"
          >
            <RefreshCw size={15} />
            רענון
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
