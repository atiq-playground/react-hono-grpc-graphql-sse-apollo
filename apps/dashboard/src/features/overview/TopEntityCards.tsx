import { BucketOverviewCard } from "./DistributionCards";
import type { DataTableRow } from "./OverviewCard";
import type { OverviewBucket } from "./overview.types";

type Props = {
  buckets: OverviewBucket[];
  className?: string;
};

type RepositoryProps = Props & {
  getRowHref?: (row: DataTableRow) => string | undefined;
};

export function ByRepositoryCard({ buckets, getRowHref, className }: RepositoryProps) {
  return (
    <BucketOverviewCard
      buckets={buckets}
      title="Top repositories"
      description="Repositories with the most matching source records."
      color="var(--chart-3)"
      labelHeading="Repository"
      getRowHref={getRowHref}
      className={className}
    />
  );
}

export function ByImageCard({ buckets, className }: Props) {
  return (
    <BucketOverviewCard
      buckets={buckets}
      title="Top images"
      description="Images with the most matching source records."
      color="var(--chart-4)"
      labelHeading="Image"
      className={className}
    />
  );
}

export function TopPackagesCard({ buckets, className }: Props) {
  return (
    <BucketOverviewCard
      buckets={buckets}
      title="Top packages"
      description="Affected packages with the most matching source records."
      color="var(--chart-5)"
      labelHeading="Package"
      className={className}
    />
  );
}
