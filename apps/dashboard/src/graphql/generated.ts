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
