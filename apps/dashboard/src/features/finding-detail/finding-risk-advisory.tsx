import { DetailItem, DetailList, DetailSection, ExternalLink, StringList } from "./detail-fields";
import type { FindingDetail } from "./finding-detail.types";

export function FindingRiskAdvisory({ finding }: { finding: FindingDetail }) {
  return (
    <DetailSection
      id="risk-advisory-heading"
      title="Risk factors and advisory"
      description="Source-provided factors, rules, and external advisory reference."
    >
      <DetailList>
        <DetailItem label="Advisory type" value={finding.advisoryType} />
        <DetailItem label="Advisory link" value={<ExternalLink value={finding.link} />} />
        <DetailItem
          label="Risk factors"
          value={<StringList values={finding.riskFactors} label="Risk factors" />}
          wide
        />
        <DetailItem
          label="Applicable rules"
          value={<StringList values={finding.applicableRules} label="Applicable rules" />}
          wide
        />
      </DetailList>
    </DetailSection>
  );
}
