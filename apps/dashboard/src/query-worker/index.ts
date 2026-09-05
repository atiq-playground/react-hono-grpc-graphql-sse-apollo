/**
 * Compact columnar index owned by the query worker (T08/T09).
 * Low-cardinality columns store dictionary indices (Uint32Array), not per-row strings.
 */
import { type DictColumn, internDictEntries, type SparseStringColumn } from "@repo/proto";

export class StringDictionary {
  readonly values: string[] = [];
  private readonly indexByValue = new Map<string, number>();
  /** UTF-16 code units × 2, matching estimateBytes. */
  byteLength = 0;

  intern(value: string): number {
    const existing = this.indexByValue.get(value);
    if (existing !== undefined) return existing;
    const id = this.values.length;
    this.values.push(value);
    this.indexByValue.set(value, id);
    this.byteLength += value.length * 2;
    return id;
  }

  /** Lookup without mutating the dictionary (for filters). */
  lookup(value: string): number | undefined {
    return this.indexByValue.get(value);
  }

  get(id: number): string {
    return this.values[id] ?? "";
  }
}

export class ColumnarIndex {
  capacity = 0;
  length = 0;

  // High-cardinality: plain string columns (still growable arrays).
  group: string[] = [];
  repo: string[] = [];
  image: string[] = [];
  cve: string[] = [];
  packageName: string[] = [];
  packageVersion: string[] = [];

  // Low-cardinality: dictionary + typed index columns.
  severityDict = new StringDictionary();
  packageTypeDict = new StringDictionary();
  statusDict = new StringDictionary();
  advisoryTypeDict = new StringDictionary();
  severityIdx = new Uint32Array(0);
  packageTypeIdx = new Uint32Array(0);
  statusIdx = new Uint32Array(0);
  advisoryTypeIdx = new Uint32Array(0);

  // Sparse-ish nullable: empty string means null/absent in dictionary slot 0 reserved? Use -1 via Int32.
  kaiStatusDict = new StringDictionary();
  /** -1 = null/absent */
  kaiStatusIdx = new Int32Array(0);

  cvss = new Float64Array(0);

  /** Running UTF-16×2 estimate of high-cardinality string columns. */
  private highCardBytes = 0;

  private ensure(extra: number): void {
    const needed = this.length + extra;
    if (needed <= this.capacity) return;
    let next = this.capacity === 0 ? 1024 : this.capacity;
    while (next < needed) next *= 2;

    const growStr = (arr: string[]) => {
      arr.length = next;
    };
    growStr(this.group);
    growStr(this.repo);
    growStr(this.image);
    growStr(this.cve);
    growStr(this.packageName);
    growStr(this.packageVersion);

    const growU32 = (arr: Uint32Array) => {
      const n = new Uint32Array(next);
      n.set(arr);
      return n;
    };
    const growI32 = (arr: Int32Array) => {
      const n = new Int32Array(next);
      n.set(arr);
      return n;
    };
    this.severityIdx = growU32(this.severityIdx);
    this.packageTypeIdx = growU32(this.packageTypeIdx);
    this.statusIdx = growU32(this.statusIdx);
    this.advisoryTypeIdx = growU32(this.advisoryTypeIdx);
    this.kaiStatusIdx = growI32(this.kaiStatusIdx);

    const cvss = new Float64Array(next);
    cvss.set(this.cvss);
    this.cvss = cvss;
    this.capacity = next;
  }

  appendBlock(cols: {
    group: readonly string[];
    repo: readonly string[];
    image: readonly string[];
    cve: readonly string[];
    packageName: readonly string[];
    packageVersion: readonly string[];
    severity?: Pick<DictColumn, "dictionary" | "indices">;
    packageType?: Pick<DictColumn, "dictionary" | "indices">;
    status?: Pick<DictColumn, "dictionary" | "indices">;
    advisoryType?: Pick<DictColumn, "dictionary" | "indices">;
    kaiStatus?: Pick<SparseStringColumn, "rowIndices" | "values">;
    cvss: readonly number[];
    rowCount?: number;
  }): void {
    const n = cols.rowCount ?? cols.group.length;
    this.ensure(n);
    const base = this.length;
    const severity = remapBlockDict(cols.severity, this.severityDict);
    const packageType = remapBlockDict(cols.packageType, this.packageTypeDict);
    const status = remapBlockDict(cols.status, this.statusDict);
    const advisoryType = remapBlockDict(cols.advisoryType, this.advisoryTypeDict);

    for (let i = 0; i < n; i++) {
      const at = base + i;
      const group = cols.group[i] ?? "";
      const repo = cols.repo[i] ?? "";
      const image = cols.image[i] ?? "";
      const cve = cols.cve[i] ?? "";
      const packageName = cols.packageName[i] ?? "";
      const packageVersion = cols.packageVersion[i] ?? "";
      this.group[at] = group;
      this.repo[at] = repo;
      this.image[at] = image;
      this.cve[at] = cve;
      this.packageName[at] = packageName;
      this.packageVersion[at] = packageVersion;
      this.highCardBytes +=
        (group.length +
          repo.length +
          image.length +
          cve.length +
          packageName.length +
          packageVersion.length) *
        2;
      this.severityIdx[at] = dictIndexAt(severity, i, this.severityDict);
      this.packageTypeIdx[at] = dictIndexAt(packageType, i, this.packageTypeDict);
      this.statusIdx[at] = dictIndexAt(status, i, this.statusDict);
      this.advisoryTypeIdx[at] = dictIndexAt(advisoryType, i, this.advisoryTypeDict);
      this.kaiStatusIdx[at] = -1;
      this.cvss[at] = cols.cvss[i] ?? 0;
    }

    const kai = cols.kaiStatus;
    if (kai) {
      for (let i = 0; i < kai.rowIndices.length; i++) {
        const row = kai.rowIndices[i];
        const value = kai.values[i];
        if (row === undefined || row < 0 || row >= n || value == null) continue;
        this.kaiStatusIdx[base + row] = this.kaiStatusDict.intern(value);
      }
    }
    this.length += n;
  }

  severityAt(i: number): string {
    return this.severityDict.get(this.severityIdx[i] ?? 0);
  }
  packageTypeAt(i: number): string {
    return this.packageTypeDict.get(this.packageTypeIdx[i] ?? 0);
  }
  statusAt(i: number): string {
    return this.statusDict.get(this.statusIdx[i] ?? 0);
  }
  kaiStatusAt(i: number): string | null {
    const id = this.kaiStatusIdx[i] ?? -1;
    return id < 0 ? null : this.kaiStatusDict.get(id);
  }

  /** Approximate retained bytes for the index (excludes V8 string overhead for high-card columns). */
  estimateBytes(): number {
    const typed = this.length * (4 * 5 + 8);
    const dictBytes =
      this.severityDict.byteLength +
      this.packageTypeDict.byteLength +
      this.statusDict.byteLength +
      this.advisoryTypeDict.byteLength +
      this.kaiStatusDict.byteLength;
    return typed + dictBytes + this.highCardBytes;
  }
}

type BlockDictRemap = {
  remap: number[];
  indices: readonly number[] | undefined;
};

function remapBlockDict(
  column: Pick<DictColumn, "dictionary" | "indices"> | undefined,
  dict: StringDictionary,
): BlockDictRemap {
  if (!column) {
    return { remap: [dict.intern("")], indices: undefined };
  }
  return {
    remap: internDictEntries(column.dictionary, (value) => dict.intern(value)),
    indices: column.indices,
  };
}

function dictIndexAt(mapped: BlockDictRemap, row: number, dict: StringDictionary): number {
  if (!mapped.indices) return mapped.remap[0] ?? dict.intern("");
  const id = mapped.remap[mapped.indices[row] ?? -1];
  return id ?? dict.intern("");
}

export type QueryArgs = {
  search: string;
  filters: Record<string, string[]>;
  sort: { field: string; direction: "asc" | "desc" };
  offset: number;
  limit: number;
  analysisMode: "all" | "analysis" | "aiAnalysis";
};

function matchesAnalysis(kai: string | null, mode: QueryArgs["analysisMode"]): boolean {
  if (mode === "all") return true;
  if (mode === "analysis") return kai !== "invalid - norisk";
  return kai !== "ai-invalid-norisk";
}

/**
 * Preserve concatenated-haystack semantics: a needle with spaces can span the
 * `cve packageName image repo` joins; a needle without spaces cannot, so per-field
 * includes is equivalent and avoids allocating the joined string.
 */
function rowMatchesSearch(
  index: ColumnarIndex,
  row: number,
  search: string,
  searchHasSpace: boolean,
): boolean {
  const cve = index.cve[row] ?? "";
  const packageName = index.packageName[row] ?? "";
  const image = index.image[row] ?? "";
  const repo = index.repo[row] ?? "";
  if (!searchHasSpace) {
    return (
      cve.toLowerCase().includes(search) ||
      packageName.toLowerCase().includes(search) ||
      image.toLowerCase().includes(search) ||
      repo.toLowerCase().includes(search)
    );
  }
  return `${cve} ${packageName} ${image} ${repo}`.toLowerCase().includes(search);
}

/** Build a Result Set permutation without mutating underlying columns. */
export function buildResultSet(
  index: ColumnarIndex,
  args: Omit<QueryArgs, "offset" | "limit">,
): number[] {
  const search = args.search.trim().toLowerCase();
  const searchHasSpace = search.includes(" ");
  const matched: number[] = [];

  const severityFilter = args.filters.severity;
  const statusFilter = args.filters.status;
  const groupFilter = args.filters.group;
  const repoFilter = args.filters.repo;
  const packageTypeFilter = args.filters.packageType;

  const severityIds =
    severityFilter && severityFilter.length > 0
      ? new Set(
          severityFilter
            .map((v) => index.severityDict.lookup(v))
            .filter((id): id is number => id !== undefined),
        )
      : null;
  const statusIds =
    statusFilter && statusFilter.length > 0
      ? new Set(
          statusFilter
            .map((v) => index.statusDict.lookup(v))
            .filter((id): id is number => id !== undefined),
        )
      : null;
  const packageTypeIds =
    packageTypeFilter && packageTypeFilter.length > 0
      ? new Set(
          packageTypeFilter
            .map((v) => index.packageTypeDict.lookup(v))
            .filter((id): id is number => id !== undefined),
        )
      : null;

  for (let i = 0; i < index.length; i++) {
    const kai = index.kaiStatusAt(i);
    if (!matchesAnalysis(kai, args.analysisMode)) continue;

    if (severityIds && !severityIds.has(index.severityIdx[i] ?? 0)) continue;
    if (statusIds && !statusIds.has(index.statusIdx[i] ?? 0)) continue;
    if (packageTypeIds && !packageTypeIds.has(index.packageTypeIdx[i] ?? 0)) continue;
    if (groupFilter?.length && !groupFilter.includes(index.group[i] ?? "")) continue;
    if (repoFilter?.length && !repoFilter.includes(index.repo[i] ?? "")) continue;

    if (search && !rowMatchesSearch(index, i, search, searchHasSpace)) continue;

    matched.push(i);
  }

  const dir = args.sort.direction === "asc" ? 1 : -1;
  const field = args.sort.field;

  // Lexical sort for dictionary columns: compare dictionary strings, not raw ids.
  matched.sort((a, b) => {
    let av: string | number = "";
    let bv: string | number = "";
    switch (field) {
      case "severity":
        av = index.severityAt(a);
        bv = index.severityAt(b);
        break;
      case "status":
        av = index.statusAt(a);
        bv = index.statusAt(b);
        break;
      case "cve":
        av = index.cve[a] ?? "";
        bv = index.cve[b] ?? "";
        break;
      case "cvss":
        av = index.cvss[a] ?? 0;
        bv = index.cvss[b] ?? 0;
        break;
      case "packageName":
        av = index.packageName[a] ?? "";
        bv = index.packageName[b] ?? "";
        break;
      default:
        av = index.group[a] ?? "";
        bv = index.group[b] ?? "";
    }
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return a - b;
  });

  return matched;
}

export function queryIndex(index: ColumnarIndex, args: QueryArgs) {
  const started = performance.now();
  const matched = buildResultSet(index, args);
  const slice = matched.slice(args.offset, args.offset + args.limit);
  return {
    total: matched.length,
    elapsedMs: performance.now() - started,
    rows: slice.map((indexRow) => ({
      index: indexRow,
      group: index.group[indexRow] ?? "",
      repo: index.repo[indexRow] ?? "",
      image: index.image[indexRow] ?? "",
      cve: index.cve[indexRow] ?? "",
      severity: index.severityAt(indexRow),
      packageName: index.packageName[indexRow] ?? "",
      packageVersion: index.packageVersion[indexRow] ?? "",
      status: index.statusAt(indexRow),
      kaiStatus: index.kaiStatusAt(indexRow),
    })),
  };
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

export function* exportCsvChunks(
  index: ColumnarIndex,
  args: Omit<QueryArgs, "offset" | "limit">,
  chunkRows = 500,
): Generator<string> {
  const matched = buildResultSet(index, args);
  yield "cve,severity,packageName,packageVersion,group,repo,image,status,kaiStatus\n";
  let buf = "";
  let count = 0;
  for (const i of matched) {
    const line = [
      csvEscape(index.cve[i] ?? ""),
      csvEscape(index.severityAt(i)),
      csvEscape(index.packageName[i] ?? ""),
      csvEscape(index.packageVersion[i] ?? ""),
      csvEscape(index.group[i] ?? ""),
      csvEscape(index.repo[i] ?? ""),
      csvEscape(index.image[i] ?? ""),
      csvEscape(index.statusAt(i)),
      csvEscape(index.kaiStatusAt(i) ?? ""),
    ].join(",");
    buf += `${line}\n`;
    count += 1;
    if (count >= chunkRows) {
      yield buf;
      buf = "";
      count = 0;
    }
  }
  if (buf) yield buf;
}

export function suggest(index: ColumnarIndex, prefix: string, limit: number): string[] {
  const p = prefix.trim().toLowerCase();
  if (!p) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < index.length && out.length < limit; i++) {
    for (const candidate of [index.cve[i], index.packageName[i], index.image[i], index.repo[i]]) {
      if (!candidate) continue;
      const lower = candidate.toLowerCase();
      if (lower.startsWith(p) && !seen.has(candidate)) {
        seen.add(candidate);
        out.push(candidate);
        if (out.length >= limit) break;
      }
    }
  }
  return out;
}
