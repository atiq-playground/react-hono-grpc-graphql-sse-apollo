import {
  AnalysisModeSchema,
  type FindingFilters,
  parseFindingCursor,
  parseFindingFilters,
  parseFindingSort,
  parseFindingId as parseSharedFindingId,
  parseTimeRangeInput,
  resolveTimeRange,
} from "@repo/shared";
import { z } from "zod/mini";
import { GRAPHQL_MAX_FIRST } from "../env.js";
import { throwClientError } from "./errors.js";
import type {
  ExportQueryInput,
  FacetsQueryInput,
  FindingsQueryInput,
  OverviewQueryInput,
} from "./findings-query.types.js";

const SORT_FIELDS = {
  CVSS: "cvss",
  SEVERITY: "severity",
  CVE: "cve",
  PUBLISHED_AT: "publishedAt",
  FIXED_AT: "fixedAt",
  PACKAGE_NAME: "packageName",
  REPO: "repo",
  UPDATED_AT: "updatedAt",
} as const;

const SORT_DIRECTIONS = {
  ASC: "asc",
  DESC: "desc",
} as const;

const ANALYSIS_MODES = {
  ALL: "all",
  ANALYSIS: "analysis",
  AI_ANALYSIS: "aiAnalysis",
} as const;

const TIME_RANGE_PRESETS = {
  LIVE: "live",
  LAST_24_HOURS: "24h",
  LAST_7_DAYS: "7d",
  LAST_30_DAYS: "30d",
  LAST_1_YEAR: "1y",
  LAST_5_YEARS: "5y",
  CUSTOM: "custom",
} as const;

// [schemas]

const RawSortSchema = z.object({
  field: z.enum(Object.keys(SORT_FIELDS) as [keyof typeof SORT_FIELDS]),
  direction: z.enum(Object.keys(SORT_DIRECTIONS) as [keyof typeof SORT_DIRECTIONS]),
});

const RawTimeRangeSchema = z.object({
  preset: z.enum(Object.keys(TIME_RANGE_PRESETS) as [keyof typeof TIME_RANGE_PRESETS]),
  from: z.optional(z.string()),
  to: z.optional(z.string()),
});

const PositiveIntegerSchema = z.number().check(z.int(), z.gte(1));
const SearchSchema = z.string().check(z.maxLength(256));
const RawExportArgsSchema = z.object({
  input: z.object({
    filters: z.optional(z.unknown()),
    sort: z.optional(z.unknown()),
    search: z.optional(z.unknown()),
    timeRange: z.optional(z.unknown()),
    analysisMode: z.optional(z.unknown()),
  }),
});

// [types]

interface RawScopeArgs {
  readonly filters?: unknown;
  readonly timeRange?: unknown;
  readonly analysisMode?: unknown;
}

function clientInput<T>(label: string, parse: () => T): T {
  try {
    return parse();
  } catch {
    throwClientError(`Invalid ${label}`);
  }
}

function parseFilters(value: unknown): FindingFilters {
  return clientInput("filters", () => parseFindingFilters(value ?? {}));
}

function parseAnalysisMode(value: unknown) {
  return clientInput("analysisMode", () => {
    const raw = z
      .enum(Object.keys(ANALYSIS_MODES) as [keyof typeof ANALYSIS_MODES])
      .parse(value ?? "ALL");
    return AnalysisModeSchema.parse(ANALYSIS_MODES[raw]);
  });
}

function parseTimeRange(value: unknown, now: Date) {
  return clientInput("timeRange", () => {
    if (value === undefined || value === null) {
      return resolveTimeRange({ preset: "live" }, now);
    }
    const raw = RawTimeRangeSchema.parse(value);
    return resolveTimeRange(
      parseTimeRangeInput({
        preset: TIME_RANGE_PRESETS[raw.preset],
        from: raw.from,
        to: raw.to,
      }),
      now,
    );
  });
}

function parseScope(args: RawScopeArgs, now: Date) {
  return {
    filters: parseFilters(args.filters),
    timeRange: parseTimeRange(args.timeRange, now),
    analysisMode: parseAnalysisMode(args.analysisMode),
  };
}

export function parseFindingsArgs(
  args: Record<string, unknown>,
  now = new Date(),
): FindingsQueryInput {
  return clientInput("findings arguments", () => {
    const rawSort =
      args.sort === undefined || args.sort === null
        ? ({ field: "CVSS", direction: "DESC" } as const)
        : RawSortSchema.parse(args.sort);
    const requestedFirst = PositiveIntegerSchema.parse(args.first ?? 50);
    const after =
      args.after === undefined || args.after === null ? null : parseFindingCursor(args.after);

    return {
      ...parseScope(args, now),
      search: SearchSchema.parse(args.search ?? "") || null,
      sort: parseFindingSort({
        field: SORT_FIELDS[rawSort.field],
        direction: SORT_DIRECTIONS[rawSort.direction],
      }),
      after,
      first: Math.min(requestedFirst, GRAPHQL_MAX_FIRST),
    };
  });
}

export function parseExportArgs(args: Record<string, unknown>, now = new Date()): ExportQueryInput {
  return clientInput("export arguments", () => {
    const raw = RawExportArgsSchema.parse(args).input;
    const parsed = parseFindingsArgs({ ...raw, after: null, first: 1 }, now);
    return {
      filters: parsed.filters,
      timeRange: parsed.timeRange,
      analysisMode: parsed.analysisMode,
      search: parsed.search,
      sort: parsed.sort,
    };
  });
}

export function parseFacetsArgs(args: Record<string, unknown>, now = new Date()): FacetsQueryInput {
  return clientInput("facets arguments", () => parseScope(args, now));
}

export function parseOverviewArgs(
  args: Record<string, unknown>,
  now = new Date(),
): OverviewQueryInput {
  return clientInput("overview arguments", () => {
    const scope = parseScope({ ...args, analysisMode: "ALL" }, now);
    return {
      filters: scope.filters,
      timeRange: scope.timeRange,
    };
  });
}

export function parseFindingId(value: unknown): string {
  return clientInput("finding id", () => parseSharedFindingId(value));
}

export function parseSuggestionArgs(args: Record<string, unknown>): {
  readonly prefix: string;
  readonly limit: number;
} {
  return clientInput("search suggestion arguments", () => ({
    prefix: z.string().check(z.minLength(1), z.maxLength(256)).parse(args.prefix),
    limit: Math.min(PositiveIntegerSchema.parse(args.limit ?? 10), 50),
  }));
}
