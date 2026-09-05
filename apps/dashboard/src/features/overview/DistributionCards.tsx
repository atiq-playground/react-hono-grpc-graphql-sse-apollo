import { useNavigate } from "react-router";
import { type DataTableRow, OverviewCard } from "./OverviewCard";
import type { OverviewBucket } from "./overview.types";
import { BucketBarChart } from "./overview-charts";

type BucketCardProps = {
  buckets: OverviewBucket[];
  title: string;
  description: string;
  color: string;
  className?: string;
  labelHeading?: string;
  getRowHref?: (row: DataTableRow) => string | undefined;
};

function toRows(buckets: OverviewBucket[]): DataTableRow[] {
  return buckets.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    value: bucket.count,
  }));
}

export function BucketOverviewCard({
  buckets,
  title,
  description,
  color,
  className,
  labelHeading,
  getRowHref,
}: BucketCardProps) {
  const navigate = useNavigate();
  const rows = toRows(buckets);
  const summary = `${rows.length.toLocaleString()} server-aggregated ${
    rows.length === 1 ? "category" : "categories"
  }. Exact labels and counts are available in the data table.`;
  const handleSelect = getRowHref
    ? (row: DataTableRow) => {
        const href = getRowHref(row);
        if (href) void navigate(href);
      }
    : undefined;

  return (
    <OverviewCard
      title={title}
      description={description}
      summary={summary}
      rows={rows}
      labelHeading={labelHeading}
      getRowHref={getRowHref}
      className={className}
    >
      <BucketBarChart rows={rows} color={color} onSelect={handleSelect} />
    </OverviewCard>
  );
}

type DistributionProps = {
  buckets: OverviewBucket[];
  getRowHref?: (row: DataTableRow) => string | undefined;
  className?: string;
};

export function SeverityDistributionCard({ buckets, getRowHref, className }: DistributionProps) {
  return (
    <BucketOverviewCard
      buckets={buckets}
      title="Severity distribution"
      description="Source records grouped by server-provided severity."
      color="var(--chart-1)"
      labelHeading="Severity"
      getRowHref={getRowHref}
      className={className}
    />
  );
}

export function StatusDistributionCard({ buckets, getRowHref, className }: DistributionProps) {
  return (
    <BucketOverviewCard
      buckets={buckets}
      title="Open and fixed status"
      description="Current status counts, including open and fixed records."
      color="var(--chart-2)"
      labelHeading="Status"
      getRowHref={getRowHref}
      className={className}
    />
  );
}

export function RiskFactorDistributionCard({ buckets, className }: DistributionProps) {
  return (
    <BucketOverviewCard
      buckets={buckets}
      title="Risk-factor distribution"
      description="Source-provided risk factors expanded and counted by ClickHouse."
      color="var(--chart-4)"
      labelHeading="Risk factor"
      className={className}
    />
  );
}

export function AgeBucketsCard({ buckets, className }: DistributionProps) {
  return (
    <BucketOverviewCard
      buckets={buckets}
      title="Vulnerability age"
      description="Published-age ranges assigned by the overview query."
      color="var(--chart-3)"
      labelHeading="Age bucket"
      className={className}
    />
  );
}

export function FixAvailabilityCard({ buckets, className }: DistributionProps) {
  return (
    <BucketOverviewCard
      buckets={buckets}
      title="Fix availability"
      description="Records grouped by the source's fix-availability state."
      color="var(--chart-2)"
      labelHeading="Availability"
      className={className}
    />
  );
}

export function TimeToFixBucketsCard({ buckets, className }: DistributionProps) {
  return (
    <BucketOverviewCard
      buckets={buckets}
      title="Time to fix"
      description="Elapsed-time buckets for records with usable published and fixed dates."
      color="var(--chart-5)"
      labelHeading="Time-to-fix bucket"
      className={className}
    />
  );
}
