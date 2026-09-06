import { cn } from "@repo/ui/lib/utils";

export const OWNER_NAME = "Atiq Rahman";
export const OWNER_EMAIL = "hi@atiqrahman.work";
export const OWNER_GITHUB_URL = "https://github.com/noonii";
export const OWNER_LINKEDIN_URL = "https://www.linkedin.com/in/atiq-r";
export const OWNER_PORTFOLIO_URL =
  "https://atiqrahman.work/?utm_source=vulnerability-dashboard&utm_campaign=playground-footer&utm_medium=referral";

const externalLinkClass =
  "text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const iconLinkClass =
  "inline-flex text-muted-foreground transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.866-.014-1.7-2.782.604-3.369-1.342-3.369-1.342-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.087.636-1.337-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0 1 12 6.844a9.56 9.56 0 0 1 2.504.337c1.909-1.294 2.748-1.025 2.748-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .267.18.578.688.48C19.138 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10Z" />
    </svg>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.125 2.062 2.062 0 0 1 0 4.125zM7.119 20.452H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

type OwnerContactBlockProps = {
  className?: string;
  /** Footer uses an `h2`; the mobile sheet keeps a paragraph under `SheetTitle`. */
  nameAs?: "h2" | "p";
};

export function OwnerContactBlock({ className, nameAs = "h2" }: OwnerContactBlockProps) {
  const NameTag = nameAs;

  return (
    <div className={cn("min-w-0 space-y-3", className)}>
      <NameTag className="text-sm font-semibold tracking-tight">{OWNER_NAME}</NameTag>
      <p className="text-sm text-muted-foreground">
        Built as an Nx/Bun playground for ClickHouse-authoritative vulnerability exploration.
      </p>
      <nav aria-label="Owner links" className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <a href={`mailto:${OWNER_EMAIL}`} className={externalLinkClass}>
          {OWNER_EMAIL}
        </a>
        <a
          href={OWNER_PORTFOLIO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={externalLinkClass}
        >
          Portfolio
        </a>
        <span aria-hidden="true" className="h-4 w-px shrink-0 bg-border" />
        <div className="flex items-center gap-3">
          <a
            href={OWNER_GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            className={iconLinkClass}
          >
            <GitHubIcon className="size-4" />
          </a>
          <a
            href={OWNER_LINKEDIN_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn"
            className={iconLinkClass}
          >
            <LinkedInIcon className="size-4" />
          </a>
        </div>
      </nav>
      <p className="text-xs text-muted-foreground">© 2026 {OWNER_NAME}. All rights reserved.</p>
    </div>
  );
}
