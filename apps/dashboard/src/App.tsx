import { lazy, Suspense } from "react";
import { createBrowserRouter, RouterProvider } from "react-router";
import { AppProviders } from "./app/providers";
import { AppShell } from "./app/shell";

const OverviewPage = lazy(() =>
  import("./routes/overview").then((m) => ({ default: m.OverviewPage })),
);
const ExplorePage = lazy(() =>
  import("./routes/explore").then((m) => ({ default: m.ExplorePage })),
);
const ComparePage = lazy(() =>
  import("./routes/compare").then((m) => ({ default: m.ComparePage })),
);
const DetailPage = lazy(() => import("./routes/detail").then((m) => ({ default: m.DetailPage })));

const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<p>Loading overview…</p>}>
            <OverviewPage />
          </Suspense>
        ),
      },
      {
        path: "explore",
        element: (
          <Suspense fallback={<p>Loading explore…</p>}>
            <ExplorePage />
          </Suspense>
        ),
      },
      {
        path: "compare",
        element: (
          <Suspense fallback={<p>Loading compare…</p>}>
            <ComparePage />
          </Suspense>
        ),
      },
      {
        path: "finding/:id",
        element: (
          <Suspense fallback={<p>Loading detail…</p>}>
            <DetailPage />
          </Suspense>
        ),
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
