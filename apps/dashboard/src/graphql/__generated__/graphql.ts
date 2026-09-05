/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type AnalysisMode =
  | 'AI_ANALYSIS'
  | 'ALL'
  | 'ANALYSIS';

export type ExportInput = {
  analysisMode?: AnalysisMode | null | undefined;
  filters?: FindingFiltersInput | null | undefined;
  search?: string | null | undefined;
  sort?: FindingSortInput | null | undefined;
  timeRange?: TimeRangeInput | null | undefined;
};

export type ExportStatus =
  | 'FAILED'
  | 'PENDING'
  | 'READY'
  | 'RUNNING';

export type FindingFiltersInput = {
  advisoryType?: Array<string> | null | undefined;
  group?: Array<string> | null | undefined;
  image?: Array<string> | null | undefined;
  kaiStatus?: Array<string> | null | undefined;
  packageType?: Array<string> | null | undefined;
  repo?: Array<string> | null | undefined;
  riskFactors?: Array<string> | null | undefined;
  severity?: Array<string> | null | undefined;
  status?: Array<string> | null | undefined;
};

export type FindingSortField =
  | 'CVE'
  | 'CVSS'
  | 'FIXED_AT'
  | 'PACKAGE_NAME'
  | 'PUBLISHED_AT'
  | 'REPO'
  | 'SEVERITY'
  | 'UPDATED_AT';

export type FindingSortInput = {
  direction: SortDirection;
  field: FindingSortField;
};

export type SearchSuggestionField =
  | 'CVE'
  | 'IMAGE'
  | 'PACKAGE_NAME'
  | 'REPO';

export type SortDirection =
  | 'ASC'
  | 'DESC';

export type TimeRangeInput = {
  from?: string | null | undefined;
  preset: TimeRangePreset;
  to?: string | null | undefined;
};

export type TimeRangePreset =
  | 'CUSTOM'
  | 'LAST_1_YEAR'
  | 'LAST_5_YEARS'
  | 'LAST_7_DAYS'
  | 'LAST_24_HOURS'
  | 'LAST_30_DAYS'
  | 'LIVE';

export type ExploreFindingFieldsFragment = { id: string, cve: string, severity: string, cvss: number, status: string, packageName: string, packageVersion: string, repo: string, image: string, publishedAt: string | null };

export type ExploreFindingsQueryVariables = Exact<{
  filters?: FindingFiltersInput | null | undefined;
  sort?: FindingSortInput | null | undefined;
  search?: string | null | undefined;
  timeRange?: TimeRangeInput | null | undefined;
  analysisMode?: AnalysisMode | null | undefined;
  after?: string | null | undefined;
  first?: number | null | undefined;
}>;


export type ExploreFindingsQuery = { findings: { totalCount: number, edges: Array<{ cursor: string, node: { id: string, cve: string, severity: string, cvss: number, status: string, packageName: string, packageVersion: string, repo: string, image: string, publishedAt: string | null } }>, pageInfo: { endCursor: string | null, hasNextPage: boolean } } };

export type FindingFacetsQueryVariables = Exact<{
  filters?: FindingFiltersInput | null | undefined;
  timeRange?: TimeRangeInput | null | undefined;
  analysisMode?: AnalysisMode | null | undefined;
}>;


export type FindingFacetsQuery = { facets: { severity: Array<{ value: string, count: number }>, status: Array<{ value: string, count: number }>, group: Array<{ value: string, count: number }>, repo: Array<{ value: string, count: number }>, image: Array<{ value: string, count: number }>, packageType: Array<{ value: string, count: number }>, advisoryType: Array<{ value: string, count: number }>, kaiStatus: Array<{ value: string, count: number }>, riskFactors: Array<{ value: string, count: number }> } };

export type VulnerabilityOverviewQueryVariables = Exact<{
  filters?: FindingFiltersInput | null | undefined;
  timeRange?: TimeRangeInput | null | undefined;
}>;


export type VulnerabilityOverviewQuery = { vulnerabilityOverview: { totals: { total: number, uniqueCves: number, analysisCount: number, aiAnalysisCount: number, averageCvss: number }, severityDistribution: Array<{ key: string, label: string, count: number }>, statusDistribution: Array<{ key: string, label: string, count: number }>, byRepository: Array<{ key: string, label: string, count: number }>, byImage: Array<{ key: string, label: string, count: number }>, topPackages: Array<{ key: string, label: string, count: number }>, riskFactorDistribution: Array<{ key: string, label: string, count: number }>, ageBuckets: Array<{ key: string, label: string, count: number }>, fixAvailability: Array<{ key: string, label: string, count: number }>, cvesFoundVsFixed: { found: number, fixed: number }, timeToFixBuckets: Array<{ key: string, label: string, count: number }>, publishedTrend: Array<{ month: string, count: number }> } };

export type FindingDetailQueryVariables = Exact<{
  id: string;
}>;


export type FindingDetailQuery = { finding: { id: string, group: string, repo: string, image: string, cve: string, severity: string, cvss: number, status: string, packageName: string, packageVersion: string, packageType: string, path: string, advisoryType: string, buildType: string, type: string, description: string, cause: string, exploit: string, fixDate: string, published: string, layerTime: string, link: string, owner: string, vecStr: string, kaiStatus: string | null, riskFactors: Array<string>, applicableRules: Array<string>, publishedAt: string | null, fixedAt: string | null, updatedAt: string } | null };

export type CompareAnalysisQueryVariables = Exact<{
  filters?: FindingFiltersInput | null | undefined;
  timeRange?: TimeRangeInput | null | undefined;
  leftMode: AnalysisMode;
  rightMode: AnalysisMode;
}>;


export type CompareAnalysisQuery = { left: { totalCount: number }, right: { totalCount: number }, leftFacets: { severity: Array<{ value: string, count: number }>, kaiStatus: Array<{ value: string, count: number }> }, rightFacets: { severity: Array<{ value: string, count: number }>, kaiStatus: Array<{ value: string, count: number }> } };

export type DatasetInfoQueryVariables = Exact<{ [key: string]: never; }>;


export type DatasetInfoQuery = { datasetInfo: { version: string, totalCount: number, lastEventId: string | null } };

export type SearchSuggestionsQueryVariables = Exact<{
  prefix: string;
  limit?: number | null | undefined;
}>;


export type SearchSuggestionsQuery = { searchSuggestions: Array<{ value: string, field: SearchSuggestionField }> };

export type CreateExportMutationVariables = Exact<{
  input: ExportInput;
}>;


export type CreateExportMutation = { createExport: { id: string, status: ExportStatus, rowCount: number | null, downloadUrl: string | null, errorMessage: string | null, expiresAt: string } };

export type ExportJobQueryVariables = Exact<{
  id: string;
}>;


export type ExportJobQuery = { exportJob: { id: string, status: ExportStatus, rowCount: number | null, downloadUrl: string | null, errorMessage: string | null, expiresAt: string } | null };

export const ExploreFindingFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ExploreFindingFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FindingRow"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"cve"}},{"kind":"Field","name":{"kind":"Name","value":"severity"}},{"kind":"Field","name":{"kind":"Name","value":"cvss"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"packageName"}},{"kind":"Field","name":{"kind":"Name","value":"packageVersion"}},{"kind":"Field","name":{"kind":"Name","value":"repo"}},{"kind":"Field","name":{"kind":"Name","value":"image"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}}]}}]} as unknown as DocumentNode<ExploreFindingFieldsFragment, unknown>;
export const ExploreFindingsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ExploreFindings"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filters"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"FindingFiltersInput"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sort"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"FindingSortInput"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"search"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"timeRange"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"TimeRangeInput"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"analysisMode"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"AnalysisMode"}},"defaultValue":{"kind":"EnumValue","value":"ALL"}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}},"defaultValue":{"kind":"IntValue","value":"50"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"findings"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filters"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filters"}}},{"kind":"Argument","name":{"kind":"Name","value":"sort"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sort"}}},{"kind":"Argument","name":{"kind":"Name","value":"search"},"value":{"kind":"Variable","name":{"kind":"Name","value":"search"}}},{"kind":"Argument","name":{"kind":"Name","value":"timeRange"},"value":{"kind":"Variable","name":{"kind":"Name","value":"timeRange"}}},{"kind":"Argument","name":{"kind":"Name","value":"analysisMode"},"value":{"kind":"Variable","name":{"kind":"Name","value":"analysisMode"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cursor"}},{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ExploreFindingFields"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"endCursor"}},{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ExploreFindingFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FindingRow"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"cve"}},{"kind":"Field","name":{"kind":"Name","value":"severity"}},{"kind":"Field","name":{"kind":"Name","value":"cvss"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"packageName"}},{"kind":"Field","name":{"kind":"Name","value":"packageVersion"}},{"kind":"Field","name":{"kind":"Name","value":"repo"}},{"kind":"Field","name":{"kind":"Name","value":"image"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}}]}}]} as unknown as DocumentNode<ExploreFindingsQuery, ExploreFindingsQueryVariables>;
export const FindingFacetsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"FindingFacets"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filters"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"FindingFiltersInput"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"timeRange"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"TimeRangeInput"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"analysisMode"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"AnalysisMode"}},"defaultValue":{"kind":"EnumValue","value":"ALL"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"facets"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filters"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filters"}}},{"kind":"Argument","name":{"kind":"Name","value":"timeRange"},"value":{"kind":"Variable","name":{"kind":"Name","value":"timeRange"}}},{"kind":"Argument","name":{"kind":"Name","value":"analysisMode"},"value":{"kind":"Variable","name":{"kind":"Name","value":"analysisMode"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"severity"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}},{"kind":"Field","name":{"kind":"Name","value":"status"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}},{"kind":"Field","name":{"kind":"Name","value":"group"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}},{"kind":"Field","name":{"kind":"Name","value":"repo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}},{"kind":"Field","name":{"kind":"Name","value":"image"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}},{"kind":"Field","name":{"kind":"Name","value":"packageType"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}},{"kind":"Field","name":{"kind":"Name","value":"advisoryType"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}},{"kind":"Field","name":{"kind":"Name","value":"kaiStatus"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}},{"kind":"Field","name":{"kind":"Name","value":"riskFactors"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}}]}}]}}]} as unknown as DocumentNode<FindingFacetsQuery, FindingFacetsQueryVariables>;
export const VulnerabilityOverviewDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"VulnerabilityOverview"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filters"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"FindingFiltersInput"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"timeRange"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"TimeRangeInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"vulnerabilityOverview"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filters"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filters"}}},{"kind":"Argument","name":{"kind":"Name","value":"timeRange"},"value":{"kind":"Variable","name":{"kind":"Name","value":"timeRange"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totals"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"uniqueCves"}},{"kind":"Field","name":{"kind":"Name","value":"analysisCount"}},{"kind":"Field","name":{"kind":"Name","value":"aiAnalysisCount"}},{"kind":"Field","name":{"kind":"Name","value":"averageCvss"}}]}},{"kind":"Field","name":{"kind":"Name","value":"severityDistribution"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}},{"kind":"Field","name":{"kind":"Name","value":"statusDistribution"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}},{"kind":"Field","name":{"kind":"Name","value":"byRepository"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}},{"kind":"Field","name":{"kind":"Name","value":"byImage"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}},{"kind":"Field","name":{"kind":"Name","value":"topPackages"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}},{"kind":"Field","name":{"kind":"Name","value":"riskFactorDistribution"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}},{"kind":"Field","name":{"kind":"Name","value":"ageBuckets"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}},{"kind":"Field","name":{"kind":"Name","value":"fixAvailability"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}},{"kind":"Field","name":{"kind":"Name","value":"cvesFoundVsFixed"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"found"}},{"kind":"Field","name":{"kind":"Name","value":"fixed"}}]}},{"kind":"Field","name":{"kind":"Name","value":"timeToFixBuckets"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"key"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}},{"kind":"Field","name":{"kind":"Name","value":"publishedTrend"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"month"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}}]}}]}}]} as unknown as DocumentNode<VulnerabilityOverviewQuery, VulnerabilityOverviewQueryVariables>;
export const FindingDetailDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"FindingDetail"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"finding"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"group"}},{"kind":"Field","name":{"kind":"Name","value":"repo"}},{"kind":"Field","name":{"kind":"Name","value":"image"}},{"kind":"Field","name":{"kind":"Name","value":"cve"}},{"kind":"Field","name":{"kind":"Name","value":"severity"}},{"kind":"Field","name":{"kind":"Name","value":"cvss"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"packageName"}},{"kind":"Field","name":{"kind":"Name","value":"packageVersion"}},{"kind":"Field","name":{"kind":"Name","value":"packageType"}},{"kind":"Field","name":{"kind":"Name","value":"path"}},{"kind":"Field","name":{"kind":"Name","value":"advisoryType"}},{"kind":"Field","name":{"kind":"Name","value":"buildType"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"cause"}},{"kind":"Field","name":{"kind":"Name","value":"exploit"}},{"kind":"Field","name":{"kind":"Name","value":"fixDate"}},{"kind":"Field","name":{"kind":"Name","value":"published"}},{"kind":"Field","name":{"kind":"Name","value":"layerTime"}},{"kind":"Field","name":{"kind":"Name","value":"link"}},{"kind":"Field","name":{"kind":"Name","value":"owner"}},{"kind":"Field","name":{"kind":"Name","value":"vecStr"}},{"kind":"Field","name":{"kind":"Name","value":"kaiStatus"}},{"kind":"Field","name":{"kind":"Name","value":"riskFactors"}},{"kind":"Field","name":{"kind":"Name","value":"applicableRules"}},{"kind":"Field","name":{"kind":"Name","value":"publishedAt"}},{"kind":"Field","name":{"kind":"Name","value":"fixedAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<FindingDetailQuery, FindingDetailQueryVariables>;
export const CompareAnalysisDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"CompareAnalysis"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filters"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"FindingFiltersInput"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"timeRange"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"TimeRangeInput"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"leftMode"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AnalysisMode"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"rightMode"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AnalysisMode"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"left"},"name":{"kind":"Name","value":"findings"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filters"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filters"}}},{"kind":"Argument","name":{"kind":"Name","value":"timeRange"},"value":{"kind":"Variable","name":{"kind":"Name","value":"timeRange"}}},{"kind":"Argument","name":{"kind":"Name","value":"analysisMode"},"value":{"kind":"Variable","name":{"kind":"Name","value":"leftMode"}}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"right"},"name":{"kind":"Name","value":"findings"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filters"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filters"}}},{"kind":"Argument","name":{"kind":"Name","value":"timeRange"},"value":{"kind":"Variable","name":{"kind":"Name","value":"timeRange"}}},{"kind":"Argument","name":{"kind":"Name","value":"analysisMode"},"value":{"kind":"Variable","name":{"kind":"Name","value":"rightMode"}}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"leftFacets"},"name":{"kind":"Name","value":"facets"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filters"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filters"}}},{"kind":"Argument","name":{"kind":"Name","value":"timeRange"},"value":{"kind":"Variable","name":{"kind":"Name","value":"timeRange"}}},{"kind":"Argument","name":{"kind":"Name","value":"analysisMode"},"value":{"kind":"Variable","name":{"kind":"Name","value":"leftMode"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"severity"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}},{"kind":"Field","name":{"kind":"Name","value":"kaiStatus"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}}]}},{"kind":"Field","alias":{"kind":"Name","value":"rightFacets"},"name":{"kind":"Name","value":"facets"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filters"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filters"}}},{"kind":"Argument","name":{"kind":"Name","value":"timeRange"},"value":{"kind":"Variable","name":{"kind":"Name","value":"timeRange"}}},{"kind":"Argument","name":{"kind":"Name","value":"analysisMode"},"value":{"kind":"Variable","name":{"kind":"Name","value":"rightMode"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"severity"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}},{"kind":"Field","name":{"kind":"Name","value":"kaiStatus"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}}]}}]}}]} as unknown as DocumentNode<CompareAnalysisQuery, CompareAnalysisQueryVariables>;
export const DatasetInfoDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"DatasetInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"datasetInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}},{"kind":"Field","name":{"kind":"Name","value":"lastEventId"}}]}}]}}]} as unknown as DocumentNode<DatasetInfoQuery, DatasetInfoQueryVariables>;
export const SearchSuggestionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SearchSuggestions"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"prefix"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}},"defaultValue":{"kind":"IntValue","value":"10"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"searchSuggestions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"prefix"},"value":{"kind":"Variable","name":{"kind":"Name","value":"prefix"}}},{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"field"}}]}}]}}]} as unknown as DocumentNode<SearchSuggestionsQuery, SearchSuggestionsQueryVariables>;
export const CreateExportDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateExport"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ExportInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createExport"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"rowCount"}},{"kind":"Field","name":{"kind":"Name","value":"downloadUrl"}},{"kind":"Field","name":{"kind":"Name","value":"errorMessage"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}}]}}]}}]} as unknown as DocumentNode<CreateExportMutation, CreateExportMutationVariables>;
export const ExportJobDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ExportJob"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"exportJob"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"rowCount"}},{"kind":"Field","name":{"kind":"Name","value":"downloadUrl"}},{"kind":"Field","name":{"kind":"Name","value":"errorMessage"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}}]}}]}}]} as unknown as DocumentNode<ExportJobQuery, ExportJobQueryVariables>;