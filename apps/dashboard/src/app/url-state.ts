import { z } from "zod/mini";

const ExploreUrlSchema = z.object({
  q: z.optional(z.string()),
  severity: z.optional(z.string()),
  sort: z.optional(z.string()),
  dir: z.optional(z.enum(["asc", "desc"])),
  mode: z.optional(z.enum(["all", "analysis", "aiAnalysis"])),
  offset: z.optional(z.string()),
});

export type ExploreUrlState = {
  search: string;
  filters: Record<string, string[]>;
  sort: { field: string; direction: "asc" | "desc" };
  analysisMode: "all" | "analysis" | "aiAnalysis";
  pageOffset: number;
};

const defaults: ExploreUrlState = {
  search: "",
  filters: {},
  sort: { field: "severity", direction: "desc" },
  analysisMode: "all",
  pageOffset: 0,
};

export function parseExploreSearch(params: URLSearchParams): ExploreUrlState {
  const raw = {
    q: params.get("q") ?? undefined,
    severity: params.get("severity") ?? undefined,
    sort: params.get("sort") ?? undefined,
    dir: params.get("dir") ?? undefined,
    mode: params.get("mode") ?? undefined,
    offset: params.get("offset") ?? undefined,
  };
  const parsed = ExploreUrlSchema.safeParse(raw);
  if (!parsed.success) return defaults;

  const offset = Number(parsed.data.offset ?? "0");
  return {
    search: parsed.data.q ?? "",
    filters: parsed.data.severity ? { severity: parsed.data.severity.split(",") } : {},
    sort: {
      field: parsed.data.sort ?? "severity",
      direction: parsed.data.dir ?? "desc",
    },
    analysisMode: parsed.data.mode ?? "all",
    pageOffset: Number.isFinite(offset) && offset >= 0 ? offset : 0,
  };
}

export function exploreStateToSearch(state: ExploreUrlState): string {
  const params = new URLSearchParams();
  if (state.search) params.set("q", state.search);
  if (state.filters.severity?.length) params.set("severity", state.filters.severity.join(","));
  params.set("sort", state.sort.field);
  params.set("dir", state.sort.direction);
  params.set("mode", state.analysisMode);
  if (state.pageOffset > 0) params.set("offset", String(state.pageOffset));
  return params.toString();
}
