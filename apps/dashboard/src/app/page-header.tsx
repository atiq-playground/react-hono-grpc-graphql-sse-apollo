import type { ReactNode } from "react";

import { PageToolbar } from "./page-toolbar";

type PageHeaderProps = {
  /** Stable id for the page `h1`; pair with the route section's `aria-labelledby`. */
  headingId: string;
  title: string;
  /** Muted supporting copy under the title. Accepts nodes for inline code/emphasis. */
  description: ReactNode;
  /** Optional uppercase eyebrow above the title. */
  eyebrow?: string;
  /**
   * Optional content after the shared `PageToolbar` (page-specific controls,
   * banners). Page body content stays outside `PageHeader`.
   */
  children?: ReactNode;
};

/**
 * Shared page intro stack: title → description → URL-backed toolbar → optional slot.
 * Spacing: toolbar owns `mt-6 mb-4`; do not add competing gaps around the intro.
 */
export function PageHeader({ headingId, title, description, eyebrow, children }: PageHeaderProps) {
  return (
    <div>
      <header>
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {eyebrow}
          </p>
        ) : null}
        <h1
          id={headingId}
          className={
            eyebrow
              ? "mt-1 text-3xl font-semibold tracking-tight"
              : "text-3xl font-semibold tracking-tight"
          }
        >
          {title}
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{description}</p>
      </header>

      <PageToolbar />

      {children}
    </div>
  );
}
