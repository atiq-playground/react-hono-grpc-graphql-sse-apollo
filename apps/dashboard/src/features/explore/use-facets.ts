import { useQuery } from "@apollo/client/react";

import type { ExploreUrlState } from "../../app/url-state";
import { FindingFacetsDocument } from "../../graphql/operations";
import { toGraphqlAnalysisMode, toGraphqlTimeRange } from "../../graphql/variables";

export function useFacets(state: ExploreUrlState) {
  return useQuery(FindingFacetsDocument, {
    variables: {
      filters: state.filters,
      timeRange: toGraphqlTimeRange(state.timeRange),
      analysisMode: toGraphqlAnalysisMode(state.analysisMode),
    },
  });
}
