import { useMutation, useQuery } from "@apollo/client/react";
import { Button } from "@repo/ui/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/components/ui/tooltip";
import { DownloadIcon, Loader2Icon } from "lucide-react";
import { useEffect, useState } from "react";

import type { ExploreUrlState } from "../../app/url-state";
import { CreateExportDocument, ExportJobDocument } from "../../graphql/operations";
import { toExportInput } from "../../graphql/variables";

type Props = {
  state: ExploreUrlState;
};

function downloadSameOrigin(urlValue: string): void {
  const url = new URL(urlValue, window.location.href);
  if (url.origin !== window.location.origin || !url.pathname.startsWith("/api/exports/")) {
    throw new Error("The export service returned an invalid download URL");
  }

  const link = document.createElement("a");
  link.href = url.href;
  link.download = "";
  document.body.append(link);
  link.click();
  link.remove();
}

export function ExportButton({ state }: Props) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [createExport, createResult] = useMutation(CreateExportDocument);
  const jobResult = useQuery(ExportJobDocument, {
    variables: { id: jobId ?? "" },
    skip: jobId === null,
    pollInterval: jobId === null ? 0 : 1_000,
    fetchPolicy: "network-only",
  });
  const job = jobResult.data?.exportJob;

  useEffect(() => {
    if (job?.status === "READY" && job.downloadUrl) {
      setJobId(null);
      try {
        downloadSameOrigin(job.downloadUrl);
        const count = job.rowCount === null ? "matching" : job.rowCount.toLocaleString();
        setMessage(`Export ready. Downloading ${count} rows.`);
      } catch (error: unknown) {
        setMessage(error instanceof Error ? error.message : "The export download could not start");
      }
    } else if (job?.status === "FAILED") {
      setJobId(null);
      setMessage(job.errorMessage ?? "Export could not be completed");
    }
  }, [job]);

  useEffect(() => {
    if (!jobResult.error) return;
    setJobId(null);
    setMessage("Export status could not be checked");
  }, [jobResult.error]);

  useEffect(() => {
    if (jobId === null || jobResult.data?.exportJob !== null) return;
    setJobId(null);
    setMessage("The export job expired before it was ready");
  }, [jobId, jobResult.data]);

  const handleExport = async () => {
    setMessage("Creating export…");
    try {
      const result = await createExport({ variables: { input: toExportInput(state) } });
      const created = result.data?.createExport;
      if (!created) throw new Error("The export job was not created");

      if (created.status === "READY" && created.downloadUrl) {
        downloadSameOrigin(created.downloadUrl);
        const count = created.rowCount === null ? "matching" : created.rowCount.toLocaleString();
        setMessage(`Export ready. Downloading ${count} rows.`);
        return;
      }
      if (created.status === "FAILED") {
        setMessage(created.errorMessage ?? "Export could not be completed");
        return;
      }

      setJobId(created.id);
      setMessage("Export is being prepared on the server…");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Export could not be started");
    }
  };

  const isWorking = createResult.loading || jobId !== null;
  const label = isWorking ? "Preparing export" : "Export CSV";

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="outline"
            aria-label={label}
            onClick={() => void handleExport()}
            disabled={isWorking}
          >
            {isWorking ? (
              <Loader2Icon className="size-4 animate-spin motion-reduce:animate-none" />
            ) : (
              <DownloadIcon className="size-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>
      <span className="max-w-64 truncate text-xs text-muted-foreground" aria-live="polite">
        {message}
      </span>
    </div>
  );
}
