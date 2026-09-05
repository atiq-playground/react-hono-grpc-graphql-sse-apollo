import { Component, type ReactNode } from "react";

type Props = {
  children: (retryKey: number) => ReactNode;
};

type State = {
  hasError: boolean;
  retryKey: number;
};

export class RouteErrorBoundary extends Component<Props, State> {
  override state: State = {
    hasError: false,
    retryKey: 0,
  };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  private handleRetry = (): void => {
    this.setState(({ retryKey }) => ({
      hasError: false,
      retryKey: retryKey + 1,
    }));
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <section
          className="flex min-h-[24rem] flex-col items-start justify-center gap-3"
          role="alert"
          aria-labelledby="route-load-error"
        >
          <h1 id="route-load-error" className="text-xl font-semibold">
            This page could not be loaded
          </h1>
          <p className="text-muted-foreground text-sm">
            Check your connection, then try loading this page again.
          </p>
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
