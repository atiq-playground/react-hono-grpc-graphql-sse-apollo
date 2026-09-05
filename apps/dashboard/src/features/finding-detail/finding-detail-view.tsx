import { FindingDatesFix } from "./finding-dates-fix";
import type { FindingDetail } from "./finding-detail.types";
import { FindingIdentityRisk } from "./finding-identity-risk";
import { FindingNarrative } from "./finding-narrative";
import { FindingPackageLocation } from "./finding-package-location";
import { FindingRiskAdvisory } from "./finding-risk-advisory";

export function FindingDetailView({ finding }: { finding: FindingDetail }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <FindingIdentityRisk finding={finding} />
      <FindingPackageLocation finding={finding} />
      <div className="lg:col-span-2">
        <FindingNarrative finding={finding} />
      </div>
      <FindingDatesFix finding={finding} />
      <FindingRiskAdvisory finding={finding} />
    </div>
  );
}
