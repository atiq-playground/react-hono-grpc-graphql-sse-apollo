import type {
  AnalysisMode,
  ExploreFinding,
  FilterField,
  FindingDetail,
  FindingFilters,
  FindingSort,
  ResolvedTimeRange,
} from "@repo/shared";

export type QueryParameters = Record<string, unknown>;

export interface CompactQuery {
  readonly query: string;
  readonly queryParams: QueryParameters;
  readonly columns: readonly string[];
  readonly maxResultRows: number;
}

export interface QueryScope {
  readonly filters: FindingFilters;
  readonly timeRange: ResolvedTimeRange;
  readonly analysisMode: AnalysisMode;
  readonly search: string | null;
}

export interface FindingsQueryInput extends QueryScope {
  readonly sort: FindingSort;
  readonly after: string | null;
  readonly first: number;
}

export interface ExportQueryInput extends QueryScope {
  readonly sort: FindingSort;
}

export type FacetsQueryInput = Omit<QueryScope, "search">;

export type OverviewQueryInput = Omit<QueryScope, "analysisMode" | "search">;

export interface FindingEdge {
  readonly cursor: string;
  readonly node: ExploreFinding;
}

export interface FindingConnection {
  readonly edges: readonly FindingEdge[];
  readonly pageInfo: {
    readonly endCursor: string | null;
    readonly hasNextPage: boolean;
  };
  readonly totalCount: number;
}

export type FindingDetailResult = FindingDetail | null;

export interface FacetValue {
  readonly value: string;
  readonly count: number;
}

export type FacetsResult = Readonly<Record<FilterField, readonly FacetValue[]>>;

export interface OverviewBucket {
  readonly key: string;
  readonly label: string;
  readonly count: number;
}

export interface VulnerabilityOverviewResult {
  readonly totals: {
    readonly total: number;
    readonly uniqueCves: number;
    readonly analysisCount: number;
    readonly aiAnalysisCount: number;
    readonly averageCvss: number;
  };
  readonly severityDistribution: readonly OverviewBucket[];
  readonly statusDistribution: readonly OverviewBucket[];
  readonly byRepository: readonly OverviewBucket[];
  readonly byImage: readonly OverviewBucket[];
  readonly topPackages: readonly OverviewBucket[];
  readonly riskFactorDistribution: readonly OverviewBucket[];
  readonly ageBuckets: readonly OverviewBucket[];
  readonly fixAvailability: readonly OverviewBucket[];
  readonly cvesFoundVsFixed: {
    readonly found: number;
    readonly fixed: number;
  };
  readonly timeToFixBuckets: readonly OverviewBucket[];
  readonly publishedTrend: readonly {
    readonly month: string;
    readonly count: number;
  }[];
}
