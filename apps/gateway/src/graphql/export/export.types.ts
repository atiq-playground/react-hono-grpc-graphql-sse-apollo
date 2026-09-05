export const EXPORT_STATUSES = ["PENDING", "RUNNING", "READY", "FAILED"] as const;
export type ExportStatus = (typeof EXPORT_STATUSES)[number];

/** GraphQL-facing export job shape (download URL, not Redis storage). */
export interface ExportJob {
  readonly id: string;
  readonly status: ExportStatus;
  readonly rowCount: number | null;
  readonly downloadUrl: string | null;
  readonly errorMessage: string | null;
  readonly expiresAt: string;
}
