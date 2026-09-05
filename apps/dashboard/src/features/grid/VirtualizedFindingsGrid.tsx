import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui";
import { createColumnHelper, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useMemo, useRef } from "react";
import { Link } from "react-router";
import type { PageRow } from "../../state/dashboard-store";

function findingId(row: PageRow): string {
  return btoa(
    JSON.stringify({
      group: row.group,
      repo: row.repo,
      image: row.image,
      cve: row.cve,
      packageName: row.packageName,
      path: "",
    }),
  )
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

const columnHelper = createColumnHelper<PageRow>();

const columns = [
  columnHelper.accessor("cve", { header: "CVE", id: "cve" }),
  columnHelper.accessor("severity", { header: "Severity", id: "severity" }),
  columnHelper.accessor("packageName", { header: "Package", id: "packageName" }),
  columnHelper.accessor("group", { header: "Group", id: "group" }),
  columnHelper.accessor("repo", { header: "Repo", id: "repo" }),
  columnHelper.accessor("status", { header: "Status", id: "status" }),
];

type Props = {
  rowByIndex: Map<number, PageRow>;
  total: number;
  onVisibleRange: (offset: number, limit: number) => void;
  onSort: (field: string) => void;
  sortField: string;
  sortDirection: "asc" | "desc";
};

const PAGE = 50;

export function VirtualizedFindingsGrid({
  rowByIndex,
  total,
  onVisibleRange,
  onSort,
  sortField,
  sortDirection,
}: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  // Headless table owns column defs + sort state only (data processing stays in worker).
  useReactTable({
    data: [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
  });

  const virtualizer = useVirtualizer({
    count: total,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 16,
  });

  const items = virtualizer.getVirtualItems();
  const rangeKey = useMemo(() => {
    if (items.length === 0) return "0:0";
    return `${items[0]?.index ?? 0}:${items[items.length - 1]?.index ?? 0}`;
  }, [items]);

  useEffect(() => {
    if (total === 0) return;
    const [startStr, endStr] = rangeKey.split(":");
    const start = Number(startStr);
    const end = Number(endStr);
    const offset = Math.max(0, Math.floor(start / PAGE) * PAGE);
    const limit = Math.max(PAGE, end - offset + PAGE);
    onVisibleRange(offset, limit);
  }, [rangeKey, total, onVisibleRange]);

  return (
    <section
      ref={parentRef}
      className="h-[480px] overflow-auto border"
      aria-label={`Findings grid, ${total.toLocaleString()} matching rows`}
    >
      <Table>
        <TableHeader className="bg-background sticky top-0 z-10">
          <TableRow>
            {columns.map((col) => {
              const id = col.id ?? "";
              const active = sortField === id;
              return (
                <TableHead
                  key={id}
                  scope="col"
                  aria-sort={
                    active ? (sortDirection === "asc" ? "ascending" : "descending") : "none"
                  }
                >
                  <button type="button" className="hover:underline" onClick={() => onSort(id)}>
                    {typeof col.header === "string" ? col.header : id}
                    {active ? (sortDirection === "asc" ? " ↑" : " ↓") : ""}
                  </button>
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            position: "relative",
            display: "block",
          }}
        >
          {items.map((item) => {
            const row = rowByIndex.get(item.index);
            return (
              <TableRow
                key={item.key}
                className="absolute left-0 flex w-full border-t"
                style={{
                  height: `${item.size}px`,
                  transform: `translateY(${item.start}px)`,
                }}
              >
                {row ? (
                  <>
                    <TableCell className="flex-1">
                      <Link className="underline" to={`/finding/${findingId(row)}`}>
                        {row.cve}
                      </Link>
                    </TableCell>
                    <TableCell className="flex-1">{row.severity}</TableCell>
                    <TableCell className="flex-1">
                      {row.packageName}@{row.packageVersion}
                    </TableCell>
                    <TableCell className="flex-1">{row.group}</TableCell>
                    <TableCell className="flex-1">{row.repo}</TableCell>
                    <TableCell className="flex-1">{row.status}</TableCell>
                  </>
                ) : (
                  <TableCell className="text-muted-foreground flex-1" colSpan={6}>
                    Loading…
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </section>
  );
}
