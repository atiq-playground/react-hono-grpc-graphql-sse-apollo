import { type DataTableRow, OverviewCard } from "./OverviewCard";
import type { VulnerabilityOverview } from "./overview.types";
import { BucketBarChart } from "./overview-charts";

type Props = {
  values: VulnerabilityOverview["cvesFoundVsFixed"];
  className?: string;
};

export function CvesFoundVsFixedCard({ values, className }: Props) {
  const rows: DataTableRow[] = [
    { key: "found", label: "CVEs found", value: values.found },
    { key: "fixed", label: "CVEs fixed", value: values.fixed },
  ];

  return (
    <OverviewCard
      title="CVEs found vs fixed"
      description="Server-provided CVE counts in the active published range."
      summary={`Found ${values.found.toLocaleString()} CVEs; fixed ${values.fixed.toLocaleString()} CVEs.`}
      rows={rows}
      labelHeading="Measure"
      className={className}
    >
      <BucketBarChart rows={rows} color="var(--chart-2)" />
    </OverviewCard>
  );
}
