import { DetailItem, DetailList, DetailSection } from "./detail-fields";
import type { FindingDetail } from "./finding-detail.types";

function SourceText({ value }: { value: string }) {
  return <p className="whitespace-pre-wrap leading-6">{value}</p>;
}

export function FindingNarrative({ finding }: { finding: FindingDetail }) {
  return (
    <DetailSection
      id="narrative-heading"
      title="Description and analysis"
      description="Source-provided text is displayed verbatim."
    >
      <DetailList>
        <DetailItem label="Description" value={<SourceText value={finding.description} />} wide />
        <DetailItem label="Cause" value={<SourceText value={finding.cause} />} wide />
        <DetailItem label="Exploit" value={<SourceText value={finding.exploit} />} wide />
      </DetailList>
    </DetailSection>
  );
}
