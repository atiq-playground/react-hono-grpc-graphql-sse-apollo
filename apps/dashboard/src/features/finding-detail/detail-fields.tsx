import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import type { ReactNode } from "react";

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

type DetailSectionProps = {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
};

export function DetailSection({ id, title, description, children }: DetailSectionProps) {
  return (
    <section aria-labelledby={id}>
      <Card className="h-full gap-5 shadow-none">
        <CardHeader>
          <CardTitle>
            <h2 id={id} className="text-base">
              {title}
            </h2>
          </CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </section>
  );
}

export function DetailList({ children }: { children: ReactNode }) {
  return <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">{children}</dl>;
}

type DetailItemProps = {
  label: string;
  value?: ReactNode;
  wide?: boolean;
  mono?: boolean;
};

export function DetailItem({ label, value, wide = false, mono = false }: DetailItemProps) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className={`mt-1 min-h-5 break-words text-sm ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

export function DateValue({ value }: { value: string | null }) {
  if (!value) return null;

  const epoch = Date.parse(value);
  if (!Number.isFinite(epoch)) return <>{value}</>;

  return (
    <time dateTime={value} title={value}>
      {DATE_FORMATTER.format(epoch)}
    </time>
  );
}

export function StringList({ values, label }: { values: readonly string[]; label: string }) {
  const occurrences = new Map<string, number>();
  const entries = values.map((value) => {
    const occurrence = (occurrences.get(value) ?? 0) + 1;
    occurrences.set(value, occurrence);
    return { id: `${value}:${occurrence}`, value };
  });

  return (
    <ul className="space-y-1.5" aria-label={label}>
      {entries.map(({ id, value }) => (
        <li
          key={id}
          className="rounded-md border border-border/70 bg-muted/40 px-2.5 py-1.5 text-sm"
        >
          {value}
        </li>
      ))}
    </ul>
  );
}

function safeExternalUrl(value: string): string | undefined {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}

export function ExternalLink({ value }: { value: string }) {
  const href = value ? safeExternalUrl(value) : undefined;
  if (!href) return <span className="break-all">{value}</span>;

  return (
    <a
      className="break-all text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {value}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
