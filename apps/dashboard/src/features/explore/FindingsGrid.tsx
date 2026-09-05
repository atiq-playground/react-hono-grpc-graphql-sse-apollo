import type { FindingSort } from "@repo/shared";
import { Button } from "@repo/ui/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import {
  flexRender,
  getCoreRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { CSSProperties, KeyboardEvent, UIEvent } from "react";
import { useRef } from "react";
import { useNavigate } from "react-router";

import {
  FINDINGS_GRID_COLUMNS,
  FINDINGS_GRID_TEMPLATE_COLUMNS,
  type FindingGridRow,
  SORTABLE_GRID_COLUMNS,
} from "./findings-grid-columns";

const FETCH_MORE_THRESHOLD_PX = 320;
const GRID_ROW_CLASS = "grid items-center";
const GRID_HEAD_CLASS = "flex h-auto min-h-10 items-center px-3 py-2";
const GRID_CELL_CLASS = "flex min-h-12 min-w-0 items-center overflow-hidden px-3 py-2.5";
const GRID_BODY_ROW_CLASS =
  "absolute top-0 left-0 grid w-full cursor-pointer items-center focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

type Props = {
  findings: FindingGridRow[];
  loadedCount: number;
  totalCount: number;
  sort: FindingSort;
  hasNextPage: boolean;
  isFetchingMore: boolean;
  loadMoreError: string | null;
  onSortChange: (sort: FindingSort) => void;
  onLoadMore: () => Promise<void>;
};

export function FindingsGrid({
  findings,
  loadedCount,
  totalCount,
  sort,
  hasNextPage,
  isFetchingMore,
  loadMoreError,
  onSortChange,
  onLoadMore,
}: Props) {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const sorting: SortingState = [{ id: sort.field, desc: sort.direction === "desc" }];
  const table = useReactTable({
    data: findings,
    columns: FINDINGS_GRID_COLUMNS,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    state: { sorting },
  });
  const rows = table.getRowModel().rows;
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 52,
    overscan: 8,
  });

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    const remaining = target.scrollHeight - target.scrollTop - target.clientHeight;
    if (remaining <= FETCH_MORE_THRESHOLD_PX && hasNextPage && !isFetchingMore) {
      void onLoadMore().catch(() => undefined);
    }
  };

  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, id: string) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    navigate(`/finding/${encodeURIComponent(id)}`);
  };

  return (
    <div>
      <div
        ref={scrollRef}
        className="h-[min(65vh,720px)] min-h-96 overflow-auto rounded-lg border bg-background"
        onScroll={handleScroll}
      >
        <Table
          aria-label="Vulnerability findings"
          aria-rowcount={totalCount}
          className="min-w-[1380px] table-fixed"
        >
          <TableHeader className="sticky top-0 z-10 block bg-background shadow-xs">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className={GRID_ROW_CLASS}
                style={{ gridTemplateColumns: FINDINGS_GRID_TEMPLATE_COLUMNS }}
              >
                {headerGroup.headers.map((header) => {
                  const sortField = SORTABLE_GRID_COLUMNS[header.column.id];
                  const isActive = sortField === sort.field;
                  const ariaSort = isActive
                    ? sort.direction === "asc"
                      ? "ascending"
                      : "descending"
                    : undefined;

                  return (
                    <TableHead
                      key={header.id}
                      scope="col"
                      aria-sort={ariaSort}
                      className={GRID_HEAD_CLASS}
                    >
                      {sortField ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-0 has-[>svg]:px-0"
                          onClick={() =>
                            onSortChange({
                              field: sortField,
                              direction: isActive && sort.direction === "asc" ? "desc" : "asc",
                            })
                          }
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <span className="text-xs text-muted-foreground" aria-hidden="true">
                            {isActive ? (sort.direction === "asc" ? "↑" : "↓") : "↕"}
                          </span>
                        </Button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody
            className="relative block"
            style={{ height: `${virtualizer.getTotalSize()}px` }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              if (!row) return null;
              const style: CSSProperties = {
                gridTemplateColumns: FINDINGS_GRID_TEMPLATE_COLUMNS,
                transform: `translateY(${virtualRow.start}px)`,
              };

              return (
                <TableRow
                  key={row.id}
                  ref={virtualizer.measureElement}
                  data-index={virtualRow.index}
                  className={GRID_BODY_ROW_CLASS}
                  style={style}
                  tabIndex={0}
                  onClick={() => navigate(`/finding/${encodeURIComponent(row.original.id)}`)}
                  onKeyDown={(event) => handleRowKeyDown(event, row.original.id)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className={GRID_CELL_CLASS}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Loaded {loadedCount.toLocaleString()} of {totalCount.toLocaleString()} matching findings
          </p>
          {loadMoreError && (
            <p className="text-xs text-destructive" role="status">
              {loadMoreError}
            </p>
          )}
        </div>
        {hasNextPage && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isFetchingMore}
            onClick={() => void onLoadMore().catch(() => undefined)}
          >
            {isFetchingMore && (
              <span
                className="size-2 animate-pulse rounded-full bg-foreground"
                aria-hidden="true"
              />
            )}
            {isFetchingMore ? "Loading more" : "Load more"}
          </Button>
        )}
      </div>
    </div>
  );
}
