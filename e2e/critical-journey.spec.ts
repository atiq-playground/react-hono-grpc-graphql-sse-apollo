import { expect, type Page, type Request, test } from "@playwright/test";

const FINDING_ID = "0123456789abcdef0123456789abcdef";
const SECOND_ID = "1123456789abcdef0123456789abcdef";
const THIRD_ID = "2123456789abcdef0123456789abcdef";
const FOURTH_ID = "3123456789abcdef0123456789abcdef";
const EXPORT_ID = "123e4567-e89b-42d3-a456-426614174000";

type GraphqlCall = {
  operationName: string;
  variables: Record<string, unknown>;
  responseBytes: number;
};

function finding(id: string, cve: string, severity = "high") {
  return {
    __typename: "FindingRow",
    id,
    cve,
    severity,
    cvss: severity === "critical" ? 9.8 : 8.2,
    status: "open",
    packageName: "openssl",
    packageVersion: "3.0.0",
    group: "platform",
    repo: "dashboard",
    image: "registry.example/dashboard:1",
    publishedAt: "2026-09-01T00:00:00.000Z",
  };
}

function connection(
  rows: readonly ReturnType<typeof finding>[],
  hasNextPage: boolean,
  totalCount = rows.length,
) {
  return {
    __typename: "FindingConnection",
    edges: rows.map((node, index) => ({
      __typename: "FindingEdge",
      cursor: `cursor-${node.id}-${index}`,
      node,
    })),
    pageInfo: {
      __typename: "PageInfo",
      endCursor: rows.length === 0 ? null : `cursor-${rows.at(-1)?.id}-${rows.length - 1}`,
      hasNextPage,
    },
    totalCount,
  };
}

const overview = {
  __typename: "VulnerabilityOverview",
  totals: {
    __typename: "OverviewTotals",
    total: 236_653,
    uniqueCves: 18_432,
    analysisCount: 220_000,
    aiAnalysisCount: 218_000,
    averageCvss: 7.4,
  },
  severityDistribution: [
    { __typename: "OverviewBucket", key: "critical", label: "Critical", count: 10_000 },
    { __typename: "OverviewBucket", key: "high", label: "High", count: 80_000 },
  ],
  statusDistribution: [
    { __typename: "OverviewBucket", key: "open", label: "Open", count: 200_000 },
  ],
  byRepository: [
    { __typename: "OverviewBucket", key: "dashboard", label: "dashboard", count: 1_000 },
  ],
  byImage: [{ __typename: "OverviewBucket", key: "image", label: "image", count: 1_000 }],
  topPackages: [{ __typename: "OverviewBucket", key: "openssl", label: "openssl", count: 900 }],
  riskFactorDistribution: [
    { __typename: "OverviewBucket", key: "reachable", label: "Reachable", count: 700 },
  ],
  ageBuckets: [{ __typename: "OverviewBucket", key: "0-30", label: "0–30 days", count: 500 }],
  fixAvailability: [
    { __typename: "OverviewBucket", key: "available", label: "Available", count: 600 },
  ],
  cvesFoundVsFixed: { __typename: "CvesFoundVsFixed", found: 1_000, fixed: 250 },
  timeToFixBuckets: [{ __typename: "OverviewBucket", key: "0-7", label: "0–7 days", count: 200 }],
  publishedTrend: [
    { __typename: "PublishedTrendBucket", month: "2026-08", count: 100 },
    { __typename: "PublishedTrendBucket", month: "2026-09", count: 120 },
  ],
};

const facets = Object.fromEntries(
  [
    ["severity", ["critical", "high"]],
    ["status", ["open"]],
    ["group", ["platform"]],
    ["repo", ["dashboard"]],
    ["image", ["registry.example/dashboard:1"]],
    ["packageType", ["npm"]],
    ["advisoryType", ["cve"]],
    ["kaiStatus", ["reviewed"]],
    ["riskFactors", ["reachable"]],
  ].map(([name, values]) => [
    name,
    (values as string[]).map((value) => ({
      __typename: "FacetValue",
      value,
      count: 10,
    })),
  ]),
);

function detail() {
  return {
    __typename: "FindingDetail",
    ...finding(FINDING_ID, "CVE-2026-0001"),
    packageType: "npm",
    path: "/usr/lib/libssl.so",
    advisoryType: "cve",
    buildType: "container",
    type: "vulnerability",
    description: "Sanitized deterministic QA fixture",
    cause: "",
    exploit: "",
    fixDate: "",
    published: "2026-09-01",
    layerTime: "",
    link: "https://example.invalid/advisory",
    owner: "platform",
    vecStr: "CVSS:3.1/AV:N",
    kaiStatus: null,
    riskFactors: ["reachable"],
    applicableRules: ["rule-1"],
    fixedAt: null,
    updatedAt: "2026-09-05T12:00:00.000Z",
  };
}

async function installEventSourceBoundary(page: Page): Promise<void> {
  await page.addInitScript(() => {
    class DeterministicEventSource extends EventTarget {
      static readonly CONNECTING = 0;
      static readonly OPEN = 1;
      static readonly CLOSED = 2;
      static instances: DeterministicEventSource[] = [];
      readonly url: string;
      readonly withCredentials = false;
      readyState = DeterministicEventSource.OPEN;
      onopen: ((event: Event) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;

      constructor(url: string | URL) {
        super();
        this.url = String(url);
        DeterministicEventSource.instances.push(this);
        queueMicrotask(() => this.onopen?.(new Event("open")));
      }

      close(): void {
        this.readyState = DeterministicEventSource.CLOSED;
      }
    }

    Object.defineProperty(window, "EventSource", { value: DeterministicEventSource });
    Object.defineProperty(window, "__qaEventSources", {
      value: DeterministicEventSource.instances,
    });
  });
}

async function waitForGraphql(
  page: Page,
  predicate: (body: { operationName?: string; variables?: Record<string, unknown> }) => boolean,
): Promise<Request> {
  return page.waitForRequest((request) => {
    if (!request.url().endsWith("/graphql") || request.method() !== "POST") return false;
    const body = request.postDataJSON() as {
      operationName?: string;
      variables?: Record<string, unknown>;
    };
    return predicate(body);
  });
}

test("bounded overview-to-export exploration journey", async ({ page }) => {
  const calls: GraphqlCall[] = [];
  const consoleErrors: string[] = [];
  const firstRows = [finding(FINDING_ID, "CVE-2026-0001"), finding(SECOND_ID, "CVE-2026-0002")];
  const nextRows = [finding(THIRD_ID, "CVE-2026-0003"), finding(FOURTH_ID, "CVE-2026-0004")];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await installEventSourceBoundary(page);
  // Intercept before Vite proxies /api/exports to the gateway (absent in this suite).
  await page.route("**/api/exports/**", async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="findings.csv"',
      },
      body: "id,cve\n0123456789abcdef0123456789abcdef,CVE-2026-0001\n",
    });
  });
  await page.route("**/graphql", async (route) => {
    const body = route.request().postDataJSON() as {
      operationName: string;
      variables?: Record<string, unknown>;
    };
    const variables = body.variables ?? {};
    let data: Record<string, unknown>;
    switch (body.operationName) {
      case "DatasetInfo":
        data = {
          datasetInfo: {
            __typename: "DatasetInfo",
            version: "qa-1",
            totalCount: 236_653,
            lastEventId: "1-0",
          },
        };
        break;
      case "VulnerabilityOverview":
        data = { vulnerabilityOverview: overview };
        break;
      case "FindingFacets":
        data = { facets: { __typename: "Facets", ...facets } };
        break;
      case "ExploreFindings": {
        const after = variables.after;
        const filters = variables.filters as { severity?: string[] } | undefined;
        if (after) data = { findings: connection(nextRows, false, 4) };
        else if (filters?.severity?.includes("critical")) {
          data = {
            findings: connection([finding(FINDING_ID, "CVE-2026-0001", "critical")], false),
          };
        } else data = { findings: connection(firstRows, true, 4) };
        break;
      }
      case "FindingDetail":
        data = { finding: detail() };
        break;
      case "SearchSuggestions":
        data = {
          searchSuggestions: [
            { __typename: "SearchSuggestion", value: "openssl", field: "PACKAGE_NAME" },
          ],
        };
        break;
      case "CreateExport":
        data = {
          createExport: {
            __typename: "ExportJob",
            id: EXPORT_ID,
            status: "PENDING",
            rowCount: null,
            downloadUrl: null,
            errorMessage: null,
            expiresAt: "2026-09-05T13:00:00.000Z",
          },
        };
        break;
      case "ExportJob":
        data = {
          exportJob: {
            __typename: "ExportJob",
            id: EXPORT_ID,
            status: "READY",
            rowCount: 1,
            downloadUrl: `/api/exports/${EXPORT_ID}`,
            errorMessage: null,
            expiresAt: "2026-09-05T13:00:00.000Z",
          },
        };
        break;
      default:
        throw new Error(`Unhandled GraphQL operation ${body.operationName}`);
    }
    const response = JSON.stringify({ data });
    calls.push({
      operationName: body.operationName,
      variables,
      responseBytes: Buffer.byteLength(response),
    });
    await route.fulfill({ status: 200, contentType: "application/json", body: response });
  });
  await page.goto("/");
  // First Chromium project pays Vite's cold lazy-chunk compile; wait past Suspense.
  await expect(page.getByRole("heading", { name: "Vulnerability overview" })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByText("236,653", { exact: true })).toBeVisible();
  await expect(page.getByText("Severity distribution")).toBeVisible();

  await page.getByRole("link", { name: "Explore" }).click();
  await expect(page.getByRole("table", { name: "Vulnerability findings" })).toBeVisible();
  await expect(page.getByText("Loaded 2 of 4 matching findings")).toBeVisible();
  const initialCall = calls.find((call) => call.operationName === "ExploreFindings");
  expect(initialCall?.variables.first).toBe(50);
  expect(initialCall?.variables.after).toBeUndefined();
  expect(initialCall?.responseBytes).toBeLessThan(50_000);

  const nextPageRequest = waitForGraphql(
    page,
    ({ operationName, variables }) =>
      operationName === "ExploreFindings" && typeof variables?.after === "string",
  );
  await page.getByRole("button", { name: "Load more" }).click();
  await nextPageRequest;
  await expect(page.getByText("Loaded 4 of 4 matching findings")).toBeVisible();

  const filterRequest = waitForGraphql(
    page,
    ({ operationName, variables }) =>
      operationName === "ExploreFindings" &&
      (variables?.filters as { severity?: string[] } | undefined)?.severity?.[0] === "critical" &&
      variables?.after == null,
  );
  await page.getByRole("combobox", { name: "Severity" }).click();
  await page.getByRole("option", { name: /critical/i }).dispatchEvent("click");
  await filterRequest;
  await expect(page.getByText("Loaded 1 of 1 matching findings")).toBeVisible();

  const searchRequest = waitForGraphql(
    page,
    ({ operationName, variables }) =>
      operationName === "ExploreFindings" &&
      variables?.search === "openssl" &&
      variables?.after == null,
  );
  await page
    .getByRole("combobox", { name: "Search CVE, package, image, or repository" })
    .fill("openssl");
  await searchRequest;

  const sortRequest = waitForGraphql(
    page,
    ({ operationName, variables }) =>
      operationName === "ExploreFindings" &&
      (variables?.sort as { field?: string } | undefined)?.field === "CVE" &&
      variables?.after == null,
  );
  await page.getByRole("button", { name: /^CVE/ }).click();
  await sortRequest;

  const windowedRequest = waitForGraphql(
    page,
    ({ operationName, variables }) =>
      operationName === "ExploreFindings" &&
      (variables?.timeRange as { preset?: string } | undefined)?.preset === "LAST_7_DAYS",
  );
  await page.getByRole("radio", { name: "Last 7 days" }).focus();
  await page.keyboard.press("Enter");
  await windowedRequest;
  await expect(page).toHaveURL(/[?&]range=7d(?:&|$)/);
  await page.waitForFunction(() => {
    const sources = Reflect.get(window, "__qaEventSources") as unknown[] | undefined;
    return Array.isArray(sources) && sources.length > 0;
  });
  await page.evaluate(
    ({ id }) => {
      const sources = Reflect.get(window, "__qaEventSources") as EventTarget[];
      const event = {
        v: 1,
        type: "findings-changed",
        datasetVersion: "qa-1",
        at: "2026-09-05T12:30:00.000Z",
        ids: [id, "a".repeat(32)],
      };
      sources.at(-1)?.dispatchEvent(
        new MessageEvent("findings-changed", {
          data: JSON.stringify(event),
          lastEventId: "2-0",
        }),
      );
    },
    { id: FINDING_ID },
  );
  await expect(page.getByRole("button", { name: "2 updates — Refresh" })).toBeVisible();

  const customRange = page.getByRole("radio", { name: "Custom relative time" });
  await customRange.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Apply" })).toBeVisible();
  await page.getByRole("button", { name: /September 1st, 2026/i }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: /September 3rd, 2026/i }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Apply" }).focus();
  await page.keyboard.press("Enter");
  await expect(customRange).toBeChecked();
  await expect(page.getByText("3 days")).toBeVisible();
  await customRange.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Clear" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("3 days")).toHaveCount(0);

  const createExportRequest = waitForGraphql(
    page,
    ({ operationName }) => operationName === "CreateExport",
  );
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const exportRequest = await createExportRequest;
  expect(exportRequest.postDataJSON()).not.toHaveProperty("variables.input.rows");
  const download = await downloadPromise;
  expect(download.url()).toContain(`/api/exports/${EXPORT_ID}`);

  const detailRequest = waitForGraphql(
    page,
    ({ operationName, variables }) =>
      operationName === "FindingDetail" && variables?.id === FINDING_ID,
  );
  const findingRow = page.getByRole("row").filter({ hasText: "CVE-2026-0001" });
  await findingRow.focus();
  await page.keyboard.press("Enter");
  await detailRequest;
  await expect(page.getByRole("heading", { name: "CVE-2026-0001" })).toBeVisible();
  await expect(page.getByText("Sanitized deterministic QA fixture")).toBeVisible();

  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);

  expect(calls.some((call) => call.responseBytes > 100_000)).toBe(false);
  expect(calls.some((call) => call.operationName.includes("finding-block"))).toBe(false);
  expect(
    await page.evaluate(() => {
      const sources = Reflect.get(window, "__qaEventSources") as { url: string }[];
      return sources.every(({ url }) => url === "/api/stream");
    }),
  ).toBe(true);
  expect(consoleErrors).toEqual([]);
});
