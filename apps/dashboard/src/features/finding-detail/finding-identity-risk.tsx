import { Badge } from "@repo/ui/components/ui/badge";

import { DetailItem, DetailList, DetailSection } from "./detail-fields";
import type { FindingDetail } from "./finding-detail.types";

export function FindingIdentityRisk({ finding }: { finding: FindingDetail }) {
  return (
    <DetailSection
      id="identity-risk-heading"
      title="Identity and risk"
      description="Source identifiers and prioritization attributes."
    >
      <DetailList>
        <DetailItem label="CVE" value={finding.cve} />
        <DetailItem label="Severity" value={<Badge variant="outline">{finding.severity}</Badge>} />
        <DetailItem label="CVSS score" value={finding.cvss} />
        <DetailItem label="CVSS vector" value={finding.vecStr} mono />
        <DetailItem label="Status" value={<Badge variant="secondary">{finding.status}</Badge>} />
        <DetailItem label="KAI status" value={finding.kaiStatus} />
        <DetailItem label="Finding type" value={finding.type} />
        <DetailItem label="Owner" value={finding.owner} />
        <DetailItem label="Finding ID" value={finding.id} wide mono />
      </DetailList>
    </DetailSection>
  );
}
