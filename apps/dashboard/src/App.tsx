import { lazy, Suspense, useMemo } from "react";
import { createBrowserRouter, RouterProvider } from "react-router";
import { AppProviders } from "./app/providers";
import { RouteErrorBoundary } from "./app/RouteErrorBoundary";
import {
  loadCompareRoute,
  loadDetailRoute,
  loadExploreRoute,
  loadOverviewRoute,
  type RouteLoader,
} from "./app/route-loaders";
import { AppShell } from "./app/shell";

type LazyRouteProps = {
  loader: RouteLoader;
};

function LazyRoute({ loader }: LazyRouteProps) {
  const Page = useMemo(() => lazy(loader), [loader]);
  return <Page />;
}

function RouteFallback({ label }: { label: string }) {
  return (
    <div
      className="flex min-h-[24rem] items-center justify-center text-sm text-muted-foreground"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      Loading {label}…
    </div>
  );
}

function routeElement(loader: RouteLoader, label: string) {
  return (
    <RouteErrorBoundary>
      {(retryKey) => (
        <Suspense fallback={<RouteFallback label={label} />}>
          <LazyRoute key={retryKey} loader={loader} />
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
        element: routeElement(loadOverviewRoute, "overview"),
      },
      {
        path: "explore",
        element: routeElement(loadExploreRoute, "explore"),
      },
      {
        path: "compare",
        element: routeElement(loadCompareRoute, "compare"),
      },
      {
        path: "finding/:id",
        element: routeElement(loadDetailRoute, "record detail"),
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
