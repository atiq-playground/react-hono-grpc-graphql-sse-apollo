/**
 * Offline harness for T08/T09 columnar index + query (no Docker / SSE required).
 */
import { encodeDictColumn } from "@repo/proto";
import { ColumnarIndex, exportCsvChunks, queryIndex, suggest } from "../src/query-worker/index.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function sparseKai(values: Array<string | null>): { rowIndices: number[]; values: string[] } {
  const rowIndices: number[] = [];
  const present: string[] = [];
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (value == null) continue;
    rowIndices.push(i);
    present.push(value);
  }
  return { rowIndices, values: present };
}

const index = new ColumnarIndex();
const N = 5_000;
index.appendBlock({
  group: Array.from({ length: N }, (_, i) => `g${i % 10}`),
  repo: Array.from({ length: N }, (_, i) => `r${i % 20}`),
  image: Array.from({ length: N }, (_, i) => `img${i % 30}`),
  cve: Array.from({ length: N }, (_, i) => `CVE-2024-${1000 + (i % 200)}`),
  severity: encodeDictColumn(
    Array.from({ length: N }, (_, i) => ["low", "medium", "high", "critical"][i % 4] ?? "low"),
  ),
  packageName: Array.from({ length: N }, (_, i) => `pkg-${i % 50}`),
  packageVersion: Array.from({ length: N }, () => "1.0.0"),
  packageType: encodeDictColumn(Array.from({ length: N }, (_, i) => (i % 2 === 0 ? "npm" : "deb"))),
  status: encodeDictColumn(Array.from({ length: N }, () => "open")),
  advisoryType: encodeDictColumn(Array.from({ length: N }, () => "nvd")),
  kaiStatus: sparseKai(
    Array.from({ length: N }, (_, i) =>
      i % 17 === 0 ? "invalid - norisk" : i % 19 === 0 ? "ai-invalid-norisk" : null,
    ),
  ),
  cvss: Array.from({ length: N }, (_, i) => (i % 10) / 2),
});

assert(index.length === N, "length");
assert(index.severityDict.values.length <= 4, "severity dict compact");
assert(index.severityIdx instanceof Uint32Array, "typed severity indices");
assert(index.kaiStatusAt(0) === "invalid - norisk", "sparse kai present");
assert(index.kaiStatusAt(1) === null, "sparse kai absent");

const beforeSort = index.cve.slice(0, 10);
const page = queryIndex(index, {
  search: "CVE-2024-1",
  filters: { severity: ["critical"] },
  sort: { field: "cve", direction: "asc" },
  offset: 0,
  limit: 25,
  analysisMode: "all",
});
assert(page.rows.length <= 25, "page slice");
assert(page.total >= page.rows.length, "total >= page");
assert(index.cve.slice(0, 10).join() === beforeSort.join(), "sort does not mutate columns");

const analysis = queryIndex(index, {
  search: "",
  filters: {},
  sort: { field: "severity", direction: "desc" },
  offset: 0,
  limit: 1,
  analysisMode: "analysis",
});
assert(analysis.total < N, "analysis excludes invalid - norisk");

const suggestions = suggest(index, "CVE-2024-10", 5);
assert(suggestions.length > 0, "suggestions");

let csv = "";
for (const chunk of exportCsvChunks(index, {
  search: "",
  filters: { severity: ["high"] },
  sort: { field: "cve", direction: "asc" },
  analysisMode: "all",
})) {
  csv += chunk;
}
assert(csv.startsWith("cve,"), "csv header");
assert(csv.includes("\n"), "csv rows");

console.log(
  JSON.stringify(
    {
      rows: index.length,
      indexBytesEstimate: index.estimateBytes(),
      queryElapsedMs: page.elapsedMs,
      pageTotal: page.total,
      analysisTotal: analysis.total,
      suggestions: suggestions.length,
      csvChars: csv.length,
    },
    null,
    2,
  ),
);
console.log("worker harness passed");
