import { Button } from "@repo/ui/components/ui/button";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useStore } from "zustand";

import { useDashboardStore } from "../app/dashboard-context";
import { PageToolbar } from "../app/page-toolbar";
import { isFindingId, useFinding } from "../features/detail/use-finding";
import {
  FindingDetailLoading,
  FindingDetailState,
  FindingLiveStatus,
} from "../features/finding-detail/finding-detail-states";
import { FindingDetailView } from "../features/finding-detail/finding-detail-view";

function hasInAppHistory(): boolean {
  const state: unknown = window.history.state;
  if (typeof state !== "object" || state === null || !("idx" in state)) return false;
  return typeof state.idx === "number" && state.idx > 0;
}

export function DetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const store = useDashboardStore();
  const isValidId = isFindingId(id);
  const { data, loading, error, refetch } = useFinding(id);
  const connection = useStore(store, (value) => value.connection);
  const liveEvent = useStore(
    store,
    (value) => value.recentFindingEvents.find((event) => event.id === id) ?? null,
  );
  const [removedId, setRemovedId] = useState<string | null>(null);
  const finding = data?.finding;
  const isRemoved = removedId === id || liveEvent?.type === "deleted";

  useEffect(() => {
    if (liveEvent?.type === "deleted") setRemovedId(id);
    if (liveEvent?.type === "upserted") {
      setRemovedId((current) => (current === id ? null : current));
    }
  }, [id, liveEvent]);

  const handleBack = () => {
    if (hasInAppHistory()) {
      void navigate(-1);
      return;
    }
    void navigate("/explore");
  };

  return (
    <section className="space-y-6" aria-labelledby="detail-heading">
      <header className="border-b pb-5">
        <Button type="button" variant="ghost" size="sm" className="-ml-3" onClick={handleBack}>
          <span aria-hidden="true">←</span>
          Back to Explore
        </Button>
        <div className="mt-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
              Record detail
            </p>
            <h1
              id="detail-heading"
              className="mt-1 break-words text-3xl font-semibold tracking-tight"
            >
              {finding?.cve || "Finding detail"}
            </h1>
            <p className="mt-2 break-all font-mono text-xs text-muted-foreground">{id}</p>
          </div>
          <FindingLiveStatus connection={connection} event={liveEvent} />
        </div>
      </header>

      <PageToolbar />

      {!isValidId && (
        <FindingDetailState
          title="Invalid finding ID"
          message="This address does not contain a valid opaque finding identifier. No request was sent."
          isError
        />
      )}
      {isValidId && isRemoved && (
        <FindingDetailState
          title="Finding no longer in dataset"
          message="A live deletion event removed this record. The previous detail is not displayed because it may be stale."
        />
      )}
      {isValidId && !isRemoved && loading && !finding && <FindingDetailLoading />}
      {isValidId && !isRemoved && error && (
        <FindingDetailState
          title="Could not load finding"
          message="The gateway did not return this record detail. Try the request again."
          isError
          onRetry={() => void refetch()}
        />
      )}
      {isValidId && !isRemoved && !loading && !error && !finding && (
        <FindingDetailState
          title="Finding not found"
          message="No current record matches this opaque finding identifier."
        />
      )}
      {isValidId && !isRemoved && finding && <FindingDetailView finding={finding} />}
    </section>
  );
}
