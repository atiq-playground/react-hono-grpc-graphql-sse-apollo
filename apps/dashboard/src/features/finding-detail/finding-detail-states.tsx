import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

import type { FindingLiveEvent, LiveConnectionState } from "../../state/dashboard-store";

const LIVE_STATUS: Record<LiveConnectionState, string> = {
  idle: "Live updates idle",
  connecting: "Connecting live updates",
  open: "Live updates connected",
  reconnecting: "Live updates reconnecting; this detail may be stale",
  closed: "Live updates unavailable; this detail may be stale",
  error: "Live updates unavailable; this detail may be stale",
};

const DETAIL_SKELETON_FIELDS = [
  "cve",
  "severity",
  "cvss",
  "vector",
  "status",
  "kai-status",
  "type",
  "owner",
] as const;

export function FindingLiveStatus({
  connection,
  event,
}: {
  connection: LiveConnectionState;
  event: FindingLiveEvent | null;
}) {
  const isConnected = connection === "open";

  return (
    <div
      className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
      aria-live="polite"
    >
      <span className="inline-flex items-center gap-1.5">
        <span
          className={`size-1.5 rounded-full ${isConnected ? "bg-emerald-600" : "bg-amber-600"}`}
          aria-hidden="true"
        />
        {LIVE_STATUS[connection]}
      </span>
      {event?.type === "upserted" && (
        <Badge variant="outline" className="font-normal">
          Updated live just now
        </Badge>
      )}
    </div>
  );
}

export function FindingDetailLoading() {
  return (
    <div className="space-y-4" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading finding detail</span>
      <Card className="gap-5 shadow-none">
        <CardContent className="grid gap-5 pt-0 sm:grid-cols-2">
          {DETAIL_SKELETON_FIELDS.map((field) => (
            <div key={field} className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-5 w-3/4" />
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}

type FindingDetailStateProps = {
  title: string;
  message: string;
  isError?: boolean;
  onRetry?: () => void;
};

export function FindingDetailState({
  title,
  message,
  isError = false,
  onRetry,
}: FindingDetailStateProps) {
  return (
    <section
      className="rounded-xl border border-dashed bg-muted/20 px-6 py-14 text-center"
      role={isError ? "alert" : "status"}
      aria-labelledby="finding-state-heading"
    >
      <h2 id="finding-state-heading" className="text-lg font-semibold">
        {title}
      </h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button className="mt-5" type="button" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      )}
    </section>
  );
}
