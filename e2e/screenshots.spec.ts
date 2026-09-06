import path from "node:path";
import { expect, type Page, test } from "@playwright/test";

/**
 * Deterministic README screenshots. GraphQL is mocked so regenerating does not
 * require ClickHouse ingest; the Vite dashboard (or an existing `bun dev`
 * server) still serves the real UI.
 *
 * Regenerate: `bunx nx run dashboard:screenshots`
 */

const FINDING_ID = "0123456789abcdef0123456789abcdef";
const SECOND_ID = "1123456789abcdef0123456789abcdef";
const SCREENSHOT_DIR = path.join(process.cwd(), "docs", "screenshots");

// Tall enough that overview chrome + aggregate summary + first chart row fit.
const DESKTOP = { width: 1280, height: 900 };

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

function connection(rows: readonly ReturnType<typeof finding>[], totalCount = rows.length) {
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
      hasNextPage: false,
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
    { __typename: "OverviewBucket", key: "medium", label: "Medium", count: 90_000 },
    { __typename: "OverviewBucket", key: "low", label: "Low", count: 56_653 },
  ],
  statusDistribution: [
    { __typename: "OverviewBucket", key: "open", label: "Open", count: 200_000 },
    { __typename: "OverviewBucket", key: "fixed", label: "Fixed", count: 36_653 },
  ],
  byRepository: [
    { __typename: "OverviewBucket", key: "dashboard", label: "dashboard", count: 12_000 },
    { __typename: "OverviewBucket", key: "gateway", label: "gateway", count: 8_000 },
  ],
  byImage: [
    {
      __typename: "OverviewBucket",
      key: "image",
      label: "registry.example/dashboard:1",
      count: 9_000,
    },
  ],
  topPackages: [
    { __typename: "OverviewBucket", key: "openssl", label: "openssl", count: 4_200 },
    { __typename: "OverviewBucket", key: "curl", label: "curl", count: 2_100 },
  ],
  riskFactorDistribution: [
    { __typename: "OverviewBucket", key: "reachable", label: "Reachable", count: 700 },
  ],
  ageBuckets: [
    { __typename: "OverviewBucket", key: "0-30", label: "0–30 days", count: 500 },
    { __typename: "OverviewBucket", key: "31-90", label: "31–90 days", count: 1_200 },
  ],
  fixAvailability: [
    { __typename: "OverviewBucket", key: "available", label: "Available", count: 600 },
  ],
  cvesFoundVsFixed: { __typename: "CvesFoundVsFixed", found: 1_000, fixed: 250 },
  timeToFixBuckets: [{ __typename: "OverviewBucket", key: "0-7", label: "0–7 days", count: 200 }],
  publishedTrend: [
    { __typename: "PublishedTrendBucket", month: "2026-07", count: 80 },
    { __typename: "PublishedTrendBucket", month: "2026-08", count: 100 },
    { __typename: "PublishedTrendBucket", month: "2026-09", count: 120 },
  ],
};

const facets = Object.fromEntries(
  [
    ["severity", ["critical", "high", "medium", "low"]],
    ["status", ["open", "fixed"]],
    ["group", ["platform"]],
    ["repo", ["dashboard", "gateway"]],
    ["image", ["registry.example/dashboard:1"]],
    ["packageType", ["npm", "deb"]],
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

async function installQuietEventSource(page: Page): Promise<void> {
  await page.addInitScript(() => {
    class QuietEventSource extends EventTarget {
      static readonly CONNECTING = 0;
      static readonly OPEN = 1;
      static readonly CLOSED = 2;
      readonly url: string;
      readonly withCredentials = false;
      readyState = QuietEventSource.OPEN;
      onopen: ((event: Event) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;

      constructor(url: string | URL) {
        super();
        this.url = String(url);
        queueMicrotask(() => this.onopen?.(new Event("open")));
      }

      close(): void {
        this.readyState = QuietEventSource.CLOSED;
      }
    }

    Object.defineProperty(window, "EventSource", { value: QuietEventSource });
  });
}

async function installGraphqlMocks(page: Page): Promise<void> {
  const rows = [
    finding(FINDING_ID, "CVE-2026-0001", "critical"),
    finding(SECOND_ID, "CVE-2026-0002"),
    finding("2123456789abcdef0123456789abcdef", "CVE-2026-0003", "medium"),
    finding("3123456789abcdef0123456789abcdef", "CVE-2026-0004", "low"),
  ];

  await page.route("**/graphql", async (route) => {
    const body = route.request().postDataJSON() as {
      operationName: string;
      variables?: Record<string, unknown>;
    };
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
      case "ExploreFindings":
        data = { findings: connection(rows, 4) };
        break;
      case "FindingDetail":
        data = { finding: detail() };
        break;
      case "SearchSuggestions":
        data = { searchSuggestions: [] };
        break;
      default:
        throw new Error(`Unhandled GraphQL operation ${body.operationName}`);
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data }),
    });
  });
}

async function settleUi(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
  // Brief settle keeps PNG edges stable after layout.
  await page.waitForTimeout(400);
}

/** Wait until overview aggregates finished and Recharts painted plot marks. */
async function waitForOverviewCharts(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: "Vulnerability overview" })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByText("Loading aggregates…")).toHaveCount(0);
  await expect(page.getByText("Loading vulnerability overview aggregates…")).toHaveCount(0);
  await expect(page.getByText("236,653", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Published trend" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Severity distribution" })).toBeVisible();
  // Reduced motion disables Recharts animation; plot marks must exist before capture.
  await expect(page.locator(".recharts-line-curve").first()).toBeVisible();
  await expect(page.locator(".recharts-bar-rectangle").first()).toBeVisible();
  await settleUi(page);
}

async function captureViewport(page: Page, filename: string): Promise<void> {
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, filename),
    fullPage: false,
    animations: "disabled",
  });
}

test.describe("README screenshots", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      process.env.PLAYWRIGHT_SCREENSHOTS !== "1",
      "set PLAYWRIGHT_SCREENSHOTS=1 (via dashboard:screenshots)",
    );
    test.skip(testInfo.project.name !== "chromium", "desktop screenshots use chromium only");
    await page.setViewportSize(DESKTOP);
    // Skip Recharts entrance animation so plot marks are present on first paint.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await installQuietEventSource(page);
    await installGraphqlMocks(page);
  });

  test("capture overview, charts, explore, detail, and narrow overview", async ({ page }) => {
    await page.goto("/");
    await waitForOverviewCharts(page);
    await captureViewport(page, "overview.png");

    // Chart-focused frame: scroll past chrome/summary so plot cards fill the shot.
    await page.getByRole("heading", { name: "Severity distribution" }).scrollIntoViewIfNeeded();
    await expect(page.locator(".recharts-bar-rectangle").first()).toBeVisible();
    await settleUi(page);
    await captureViewport(page, "overview-charts.png");

    await page.getByRole("link", { name: "Explore" }).click();
    await expect(page.getByRole("table", { name: "Vulnerability findings" })).toBeVisible();
    await expect(page.getByText("Loaded 4 of 4 matching findings")).toBeVisible();
    await settleUi(page);
    await captureViewport(page, "explore.png");

    const findingRow = page.getByRole("row").filter({ hasText: "CVE-2026-0001" });
    await findingRow.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "CVE-2026-0001" })).toBeVisible();
    await expect(page.getByText("Sanitized deterministic QA fixture")).toBeVisible();
    await settleUi(page);
    await captureViewport(page, "detail.png");

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await waitForOverviewCharts(page);
    // Stay at top so closed Menu (hamburger) is in-frame; charts live in overview-charts.png.
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.getByRole("button", { name: "Open primary navigation" })).toBeVisible();
    await settleUi(page);
    await captureViewport(page, "overview-narrow.png");

    await page.getByRole("button", { name: "Open primary navigation" }).click();
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
    await settleUi(page);
    await captureViewport(page, "overview-narrow-menu.png");
  });
});
