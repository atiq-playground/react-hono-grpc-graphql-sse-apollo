import { Button } from "@repo/ui/components/ui/button";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

const SKELETON_ROWS = ["one", "two", "three", "four", "five", "six", "seven", "eight"] as const;

export function FindingsLoadingState() {
  return (
    <div className="space-y-2 rounded-lg border p-4" role="status" aria-label="Loading findings">
      <span className="visually-hidden">Loading a bounded findings page…</span>
      {SKELETON_ROWS.map((row) => (
        <Skeleton key={row} className="h-10 w-full" />
      ))}
    </div>
  );
}

type ErrorProps = {
  onRetry: () => void;
};

export function FindingsErrorState({ onRetry }: ErrorProps) {
  return (
    <div className="rounded-lg border border-destructive/40 p-6 text-center" role="alert">
      <h2 className="font-semibold text-destructive">Findings could not be loaded</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        The bounded query failed. Existing filters remain in the URL.
      </p>
      <Button className="mt-4" type="button" variant="outline" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

export function FindingsEmptyState() {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center" role="status">
      <h2 className="font-semibold">No matching findings</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Adjust the search, filters, analysis mode, or published time range.
      </p>
    </div>
  );
}
