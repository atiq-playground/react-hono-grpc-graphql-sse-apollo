import { NavLink, Outlet } from "react-router";
import { useTheme } from "./providers";
import {
  loadCompareRoute,
  loadExploreRoute,
  loadOverviewRoute,
  prefetchRoute,
  type RouteLoader,
} from "./route-loaders";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? "font-semibold underline" : "text-muted-foreground hover:underline";

function intentPrefetchProps(loader: RouteLoader) {
  const prefetch = () => prefetchRoute(loader);
  return {
    onFocus: prefetch,
    onMouseEnter: prefetch,
  };
}

export function AppShell() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b px-4 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <nav aria-label="Primary" className="flex gap-4">
            <NavLink to="/" className={linkClass} end {...intentPrefetchProps(loadOverviewRoute)}>
              Overview
            </NavLink>
            <NavLink to="/explore" className={linkClass} {...intentPrefetchProps(loadExploreRoute)}>
              Explore
            </NavLink>
            <NavLink to="/compare" className={linkClass} {...intentPrefetchProps(loadCompareRoute)}>
              Compare
            </NavLink>
          </nav>
          <button
            type="button"
            className="rounded border px-2 py-1 text-sm"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            Theme: {theme}
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4">
        <Outlet />
      </main>
    </div>
  );
}
