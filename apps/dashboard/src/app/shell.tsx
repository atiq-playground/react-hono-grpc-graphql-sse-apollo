import { Button } from "@repo/ui/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@repo/ui/components/ui/sheet";
import { cn } from "@repo/ui/lib/utils";
import { MenuIcon, MoonIcon, SunIcon } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import { DatasetEventsProvider } from "../features/live/dataset-events-provider";
import { useTheme } from "./dashboard-context";
import { AppFooter } from "./footer";
import { OwnerContactBlock } from "./owner-contact";
import {
  loadCompareRoute,
  loadExploreRoute,
  loadOverviewRoute,
  prefetchRoute,
  type RouteLoader,
} from "./route-loaders";
import { TechStackTags } from "./tech-stack-tags";

const GITHUB_REPO_URL = "https://github.com/atiq-playground/react-hono-grpc-graphql-sse-apollo";

const PRIMARY_NAV_ITEMS = [
  { to: "/", label: "Overview", end: true as const, loader: loadOverviewRoute },
  { to: "/explore", label: "Explore", loader: loadExploreRoute },
  { to: "/compare", label: "Compare", loader: loadCompareRoute },
];

const desktopLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "rounded-full px-4 py-1.5 text-sm font-medium transition-colors outline-none",
    "focus-visible:ring-ring/50 focus-visible:ring-[3px]",
    isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
  );

const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "block rounded-md px-3 py-2.5 text-sm font-medium transition-colors outline-none",
    "focus-visible:ring-ring/50 focus-visible:ring-[3px]",
    isActive ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent",
  );

const brandLinkClass =
  "flex shrink-0 items-center gap-2.5 rounded-sm outline-none transition-colors hover:opacity-80 focus-visible:ring-[3px] focus-visible:ring-ring/50";

function intentPrefetchProps(loader: RouteLoader) {
  const prefetch = () => prefetchRoute(loader);
  return {
    onFocus: prefetch,
    onMouseEnter: prefetch,
  };
}

function BrandMark() {
  return (
    <>
      <span
        aria-hidden="true"
        className="flex size-8 items-center justify-center rounded-lg border border-border bg-muted text-base font-semibold text-muted-foreground"
      >
        ?
      </span>
      <span className="text-sm font-semibold tracking-tight text-foreground">Atiq Dashboard</span>
    </>
  );
}

function MobilePrimaryNav() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="rounded-full text-foreground md:hidden"
          aria-label="Open primary navigation"
        >
          <MenuIcon aria-hidden="true" className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="gap-0 p-0 sm:max-w-xs">
        <SheetHeader className="border-b border-border pr-12 text-left">
          <SheetTitle asChild>
            <NavLink
              to="/"
              end
              className={brandLinkClass}
              onClick={close}
              {...intentPrefetchProps(loadOverviewRoute)}
            >
              <BrandMark />
            </NavLink>
          </SheetTitle>
          <SheetDescription className="sr-only">
            Primary navigation and contact details
          </SheetDescription>
        </SheetHeader>
        <nav aria-label="Primary" className="flex flex-col gap-0.5 px-3 py-4">
          {PRIMARY_NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={mobileLinkClass}
              onClick={close}
              {...intentPrefetchProps(item.loader)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <SheetFooter className="mt-auto border-t border-border bg-muted/35">
          <OwnerContactBlock nameAs="p" />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/** Fade in page content on pathname change; shell chrome stays put. */
function RouteOutlet() {
  const { pathname } = useLocation();
  return (
    <div key={pathname} className="route-fade-in">
      <Outlet />
    </div>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.866-.014-1.7-2.782.604-3.369-1.342-3.369-1.342-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.087.636-1.337-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0 1 12 6.844a9.56 9.56 0 0 1 2.504.337c1.909-1.294 2.748-1.025 2.748-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .267.18.578.688.48C19.138 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10Z" />
    </svg>
  );
}

export function AppShell() {
  const { theme, setTheme } = useTheme();
  const nextTheme = theme === "light" ? "dark" : "light";

  return (
    <DatasetEventsProvider>
      <div className="flex min-h-screen flex-col text-foreground">
        <header className="pt-4 pb-6">
          <div className="layout-container relative flex items-center justify-between">
            <NavLink
              to="/"
              end
              className={cn("relative z-10", brandLinkClass)}
              {...intentPrefetchProps(loadOverviewRoute)}
            >
              <BrandMark />
            </NavLink>
            <nav
              aria-label="Primary"
              className="absolute left-1/2 hidden -translate-x-1/2 items-center md:flex"
            >
              <div className="flex items-center rounded-full bg-muted p-1">
                {PRIMARY_NAV_ITEMS.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={desktopLinkClass}
                    {...intentPrefetchProps(item.loader)}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </nav>
            <div className="relative z-10 flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-full"
                aria-label={`Switch to ${nextTheme} theme`}
                onClick={() => setTheme(nextTheme)}
              >
                {theme === "light" ? (
                  <MoonIcon aria-hidden="true" />
                ) : (
                  <SunIcon aria-hidden="true" />
                )}
              </Button>
              <Button variant="ghost" size="icon" className="rounded-full" asChild>
                <a
                  href={GITHUB_REPO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="View project on GitHub"
                >
                  <GitHubIcon className="size-4" />
                </a>
              </Button>
              <MobilePrimaryNav />
            </div>
          </div>
        </header>
        <main className="layout-container flex-1 pb-4 pt-2">
          <TechStackTags />
          <RouteOutlet />
        </main>
        <AppFooter />
      </div>
    </DatasetEventsProvider>
  );
}
