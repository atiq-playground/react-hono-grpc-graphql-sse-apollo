import { DetailItem, DetailList, DetailSection } from "./detail-fields";
import type { FindingDetail } from "./finding-detail.types";

export function FindingPackageLocation({ finding }: { finding: FindingDetail }) {
  return (
    <DetailSection
      id="package-location-heading"
      title="Package and location"
      description="Affected package and source context preserved from the record."
    >
      <DetailList>
        <DetailItem label="Package name" value={finding.packageName} />
        <DetailItem label="Package version" value={finding.packageVersion} />
        <DetailItem label="Package type" value={finding.packageType} />
        <DetailItem label="Build type" value={finding.buildType} />
        <DetailItem label="Group" value={finding.group} />
        <DetailItem label="Repository" value={finding.repo} />
        <DetailItem label="Image" value={finding.image} wide />
        <DetailItem label="Path" value={finding.path} wide mono />
      </DetailList>
    </DetailSection>
  );
}
