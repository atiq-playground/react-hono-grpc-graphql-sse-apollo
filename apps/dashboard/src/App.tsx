import { TwinOrbit } from "@repo/ui/components/loading-ui/twin-orbit";
import { type ComponentType, type LazyExoticComponent, lazy, Suspense } from "react";
import { createBrowserRouter, RouterProvider } from "react-router";
import { AppProviders } from "./app/providers";
import { formatDetailError, RouteErrorBoundary } from "./app/RouteErrorBoundary";
import {
  loadCompareRoute,
  loadDetailRoute,
  loadExploreRoute,
  loadOverviewRoute,
} from "./app/route-loaders";
import { AppShell } from "./app/shell";

// Module-level lazy() — do not create React.lazy inside render/useMemo.
// Per-mount lazy types (StrictMode remounts) can leave Suspense pending forever.
const OverviewPage = lazy(loadOverviewRoute);
const ExplorePage = lazy(loadExploreRoute);
const ComparePage = lazy(loadCompareRoute);
const DetailPage = lazy(loadDetailRoute);

function RouteFallback({ message }: { message: string }) {
  return (
    <div
      className="flex min-h-[24rem] items-center justify-center text-muted-foreground"
      aria-busy="true"
    >
      <TwinOrbit className="size-2.5" aria-label={message} />
    </div>
  );
}

type RouteElementOptions = {
  fallback: string;
  formatError?: (error: unknown) => string;
};

function routeElement(Page: LazyExoticComponent<ComponentType>, options: RouteElementOptions) {
  return (
    <RouteErrorBoundary formatError={options.formatError}>
      {(retryKey) => (
        <Suspense fallback={<RouteFallback message={options.fallback} />}>
          <Page key={retryKey} />
        </Suspense>
      )}
    </RouteErrorBoundary>
  );
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      {
        index: true,
        element: routeElement(OverviewPage, { fallback: "Loading aggregates…" }),
      },
      {
        path: "explore",
        element: routeElement(ExplorePage, { fallback: "Loading explore…" }),
      },
      {
        path: "compare",
        element: routeElement(ComparePage, { fallback: "Loading compare…" }),
      },
      {
        path: "finding/:id",
        element: routeElement(DetailPage, {
          fallback: "Loading…",
          formatError: formatDetailError,
        }),
      },
    ],
  },
]);

export function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}

export default App;
