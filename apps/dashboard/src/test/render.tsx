import { type RenderOptions, type RenderResult, render } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";

/**
 * Shared render helper for dashboard tests.
 * Composes providers that T11 will own (router, Apollo, theme). Until then,
 * this is a thin wrapper so specs can import one entry point.
 */
export type DashboardProvidersProps = {
  children: ReactNode;
};

export function DashboardProviders({ children }: DashboardProvidersProps) {
  return children;
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
): RenderResult {
  return render(ui, {
    wrapper: DashboardProviders,
    ...options,
  });
}
