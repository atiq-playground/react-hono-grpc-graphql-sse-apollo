import { Component, type ReactNode } from "react";

type Props = {
  children: (retryKey: number) => ReactNode;
  /** User-facing body copy for a thrown error. Defaults to gateway unavailable. */
  formatError?: (error: unknown) => string;
};

type State = {
  hasError: boolean;
  retryKey: number;
  error: unknown;
};

function defaultFormatError(_error: unknown): string {
  return "Gateway unavailable. Try again later.";
}

export function formatDetailError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("Invalid finding id")) {
    return "Invalid finding id";
  }
  return "Could not load this finding. Try again later.";
}

export class RouteErrorBoundary extends Component<Props, State> {
  override state: State = {
    hasError: false,
    retryKey: 0,
    error: null,
  };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { hasError: true, error };
  }

  private handleRetry = (): void => {
    this.setState(({ retryKey }) => ({
      hasError: false,
      retryKey: retryKey + 1,
      error: null,
    }));
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      const formatError = this.props.formatError ?? defaultFormatError;
      return (
        <section
          className="flex min-h-[24rem] flex-col items-start justify-center gap-3"
          role="alert"
          aria-labelledby="route-load-error"
        >
          <h1 id="route-load-error" className="text-xl font-semibold">
            This page could not be loaded
          </h1>
          <p className="text-destructive text-sm">{formatError(this.state.error)}</p>
          <button
            type="button"
            className="rounded border px-3 py-2 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={this.handleRetry}
          >
            Try again
          </button>
        </section>
      );
    }

    return this.props.children(this.state.retryKey);
  }
}
