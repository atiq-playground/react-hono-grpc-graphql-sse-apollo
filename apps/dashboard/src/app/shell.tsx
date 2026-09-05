import { NavLink, Outlet } from "react-router";
import { useTheme } from "./providers";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? "font-semibold underline" : "text-muted-foreground hover:underline";

export function AppShell() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b px-4 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <nav aria-label="Primary" className="flex gap-4">
            <NavLink to="/" className={linkClass} end>
              Overview
            </NavLink>
            <NavLink to="/explore" className={linkClass}>
              Explore
            </NavLink>
            <NavLink to="/compare" className={linkClass}>
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
