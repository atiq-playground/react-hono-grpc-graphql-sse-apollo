import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import { cn } from "@repo/ui/lib/utils";
import type { ReactNode } from "react";
import { useId } from "react";
import { Link } from "react-router";

export type DataTableRow = {
  key: string;
  label: string;
  value: number;
};

type Props = {
  title: string;
  description: string;
  summary: string;
  rows: readonly DataTableRow[];
  labelHeading?: string;
  className?: string;
  getRowHref?: (row: DataTableRow) => string | undefined;
  children: ReactNode;
};

function hasPlottableData(rows: readonly DataTableRow[]): boolean {
  return rows.some((row) => row.value > 0);
}

export function OverviewCard({
  title,
  description,
  summary,
  rows,
  labelHeading = "Category",
  className,
  getRowHref,
  children,
}: Props) {
  const headingId = useId();
  const summaryId = useId();
  const emptyId = useId();
  const isEmpty = !hasPlottableData(rows);

  return (
    <Card className={cn("min-w-0 gap-4 py-5", className)}>
      <CardHeader className="gap-1 px-5">
        <CardTitle>
          <h2 id={headingId} className="text-base">
            {title}
          </h2>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="px-5">
        <figure aria-labelledby={headingId} aria-describedby={isEmpty ? emptyId : summaryId}>
          <div className="relative h-56 min-w-0">
            <div className="h-full min-w-0" aria-hidden="true">
              {children}
            </div>
            {isEmpty ? (
              <p
                id={emptyId}
                role="status"
                className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
              >
                <span className="rounded-md bg-card/90 px-3 py-1.5 text-sm text-muted-foreground">
                  No data
                </span>
              </p>
            ) : null}
          </div>
          {isEmpty ? null : (
            <figcaption id={summaryId} className="mt-3 text-sm text-muted-foreground">
              {summary}
            </figcaption>
          )}
        </figure>

        {!isEmpty && (
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer rounded-sm font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2">
              View data table
            </summary>
            <div className="mt-2 max-h-72 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{labelHeading}</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const href = getRowHref?.(row);
                    return (
                      <TableRow key={row.key}>
                        <TableCell className="max-w-64 break-words font-medium">
                          {href ? (
                            <Link
                              to={href}
                              className="rounded-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
                            >
                              {row.label}
                            </Link>
                          ) : (
                            row.label
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.value.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
