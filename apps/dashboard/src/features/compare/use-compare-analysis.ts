import { useQuery } from "@apollo/client/react";
import type { AnalysisMode, FindingFilters, TimeRangeInput } from "@repo/shared";

import { CompareAnalysisDocument } from "../../graphql/operations";
import { toGraphqlAnalysisMode, toGraphqlTimeRange } from "../../graphql/variables";

export function useCompareAnalysis(
  filters: FindingFilters,
  timeRange: TimeRangeInput,
  left: AnalysisMode,
  right: AnalysisMode,
  enabled: boolean,
) {
  return useQuery(CompareAnalysisDocument, {
    variables: {
      filters,
      timeRange: toGraphqlTimeRange(timeRange),
      leftMode: toGraphqlAnalysisMode(left),
      rightMode: toGraphqlAnalysisMode(right),
    },
    skip: !enabled || left === right,
  });
}
