/** Generated operation types for the gateway GraphQL schema (T07). */
export type SeverityCount = { severity: string; count: number };
export type Summary = {
  total: number;
  bySeverity: SeverityCount[];
  analysisCount: number;
  aiAnalysisCount: number;
};
export type FacetValue = { value: string; count: number };
export type Facets = {
  severity: FacetValue[];
  packageType: FacetValue[];
  status: FacetValue[];
  advisoryType: FacetValue[];
  group: FacetValue[];
  repo: FacetValue[];
  kaiStatus: FacetValue[];
};
export type StreamDescriptor = {
  datasetVersion: string;
  totalRecords: number;
  cursor: string;
  redisStream: string;
  ssePath: string;
};

export type SummaryQuery = { summary: Summary };
export type FacetsQuery = { facets: Facets };
export type StreamDescriptorQuery = { streamDescriptor: StreamDescriptor };

/** Combined documents used by dashboard routes. */
export type OverviewQuery = SummaryQuery & FacetsQuery;
export type ExploreBootstrapQuery = StreamDescriptorQuery & FacetsQuery;

export type FindingDetail = {
  id: string;
  group: string;
  repo: string;
  image: string;
  cve: string;
  severity: string;
  packageName: string;
  packageVersion: string;
  status: string;
  kaiStatus: string | null;
  description: string;
  cvss: number;
};

export type FindingDetailQuery = { finding: FindingDetail | null };
export type FindingDetailVariables = { id: string };

/** Variables type for operations with an empty variable set. */
export type NoVariables = Record<string, never>;
