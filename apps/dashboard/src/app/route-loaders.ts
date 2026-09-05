import type { ComponentType } from "react";

export type RouteLoader = () => Promise<{
  default: ComponentType;
}>;

export const loadOverviewRoute: RouteLoader = () =>
  import("../routes/overview").then(({ OverviewPage }) => ({ default: OverviewPage }));

export const loadExploreRoute: RouteLoader = () =>
  import("../routes/explore").then(({ ExplorePage }) => ({ default: ExplorePage }));

export const loadCompareRoute: RouteLoader = () =>
  import("../routes/compare").then(({ ComparePage }) => ({ default: ComparePage }));

export const loadDetailRoute: RouteLoader = () =>
  import("../routes/detail").then(({ DetailPage }) => ({ default: DetailPage }));

const prefetchedRoutes = new Map<RouteLoader, Promise<unknown>>();

export function prefetchRoute(loader: RouteLoader): void {
  if (prefetchedRoutes.has(loader)) return;

  const pending = loader();
  prefetchedRoutes.set(loader, pending);
  void pending.catch(() => {
    if (prefetchedRoutes.get(loader) === pending) {
      prefetchedRoutes.delete(loader);
    }
  });
}
