import { type ComponentType, type LazyExoticComponent, lazy, Suspense } from "react";
import { createBrowserRouter, RouterProvider } from "react-router";
import { AppProviders } from "./app/providers";
import { RouteErrorBoundary } from "./app/RouteErrorBoundary";
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

function routeElement(Page: LazyExoticComponent<ComponentType>, label: string) {
  return (
    <RouteErrorBoundary>
      {(retryKey) => (
        <Suspense fallback={<RouteFallback label={label} />}>
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
        element: routeElement(OverviewPage, "overview"),
      },
      {
        path: "explore",
        element: routeElement(ExplorePage, "explore"),
      },
      {
        path: "compare",
        element: routeElement(ComparePage, "compare"),
      },
      {
        path: "finding/:id",
        element: routeElement(DetailPage, "record detail"),
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
