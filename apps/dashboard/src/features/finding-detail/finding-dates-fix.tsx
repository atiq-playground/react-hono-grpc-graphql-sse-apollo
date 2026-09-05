import { DateValue, DetailItem, DetailList, DetailSection } from "./detail-fields";
import type { FindingDetail } from "./finding-detail.types";

export function FindingDatesFix({ finding }: { finding: FindingDetail }) {
  return (
    <DetailSection
      id="dates-fix-heading"
      title="Dates and fix"
      description="Source date strings and normalized query dates, without inferred values."
    >
      <DetailList>
        <DetailItem label="Published (source)" value={<DateValue value={finding.published} />} />
        <DetailItem label="Published at" value={<DateValue value={finding.publishedAt} />} />
        <DetailItem label="Fix date (source)" value={<DateValue value={finding.fixDate} />} />
        <DetailItem label="Fixed at" value={<DateValue value={finding.fixedAt} />} />
        <DetailItem label="Layer time" value={<DateValue value={finding.layerTime} />} />
        <DetailItem label="Last updated" value={<DateValue value={finding.updatedAt} />} />
      </DetailList>
    </DetailSection>
  );
}
