import type { SortField } from "@repo/shared";
import { Badge } from "@repo/ui/components/ui/badge";
import type { ColumnDef } from "@tanstack/react-table";
import { Link } from "react-router";

import type { ExploreFindingsQuery } from "../../graphql/__generated__/graphql";
import { SeverityBadge } from "./SeverityBadge";

export type FindingGridRow = ExploreFindingsQuery["findings"]["edges"][number]["node"];

export const FINDINGS_GRID_TEMPLATE_COLUMNS = "140px 140px 90px 140px 250px 220px 280px 160px";

export const SORTABLE_GRID_COLUMNS: Readonly<Partial<Record<string, SortField>>> = {
  cve: "cve",
  severity: "severity",
  cvss: "cvss",
  packageName: "packageName",
  repo: "repo",
  publishedAt: "publishedAt",
};

function formatPublished(value: string | null): string {
  if (value === null) return "—";
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(timestamp);
}

export const FINDINGS_GRID_COLUMNS: ColumnDef<FindingGridRow>[] = [
  {
    accessorKey: "cve",
    header: "CVE",
    cell: ({ row }) => (
      <Link
        className="min-w-0 truncate font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        to={`/finding/${encodeURIComponent(row.original.id)}`}
      >
        {row.original.cve}
      </Link>
    ),
  },
  {
    accessorKey: "severity",
    header: "Severity",
    cell: ({ row }) => <SeverityBadge severity={row.original.severity} />,
  },
  {
    accessorKey: "cvss",
    header: "CVSS",
    cell: ({ row }) => row.original.cvss.toFixed(1),
  },
  {
    accessorKey: "status",
    header: "Status",
    enableSorting: false,
    cell: ({ row }) => <Badge variant="outline">{row.original.status || "Unknown"}</Badge>,
  },
  {
    accessorKey: "packageName",
    header: "Package",
    cell: ({ row }) => (
      <span className="block min-w-0 truncate" title={row.original.packageName}>
        {row.original.packageName}
        <span className="text-muted-foreground">@{row.original.packageVersion || "unknown"}</span>
      </span>
    ),
  },
  {
    accessorKey: "repo",
    header: "Repository",
    cell: ({ row }) => (
      <span className="block min-w-0 truncate" title={row.original.repo}>
        {row.original.repo || "—"}
      </span>
    ),
  },
  {
    accessorKey: "image",
    header: "Image",
    enableSorting: false,
    cell: ({ row }) => (
      <span className="block min-w-0 truncate" title={row.original.image}>
        {row.original.image || "—"}
      </span>
    ),
  },
  {
    accessorKey: "publishedAt",
    header: "Published",
    cell: ({ row }) => formatPublished(row.original.publishedAt),
  },
];
