import { expect, type Page, type Response, test } from "@playwright/test";

test.skip(
  process.env.T32_REAL_STACK !== "1",
  "requires the local ClickHouse/Redis application stack",
);

function waitForGraphql(
  page: Page,
  operationName: string,
  predicate: (variables: Record<string, unknown>) => boolean = () => true,
): Promise<Response> {
  return page.waitForResponse((response) => {
    const request = response.request();
    if (!request.url().endsWith("/graphql") || request.method() !== "POST") return false;
    const body = request.postDataJSON() as {
      operationName?: string;
      variables?: Record<string, unknown>;
    };
    return body.operationName === operationName && predicate(body.variables ?? {});
  });
}

test("real bounded exploration works at desktop and narrow widths", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  const overviewResponse = waitForGraphql(page, "VulnerabilityOverview");
  await page.goto("/");
  const overviewBytes = (await (await overviewResponse).body()).byteLength;
  await expect(page.getByRole("heading", { name: "Vulnerability overview" })).toBeVisible();
  await expect(page.getByText("236,653", { exact: true })).toBeVisible();

  const firstPageResponse = waitForGraphql(
    page,
    "ExploreFindings",
    (variables) => variables.after == null,
  );
  await page.getByRole("link", { name: "Explore" }).click();
  const firstPageBody = await (await firstPageResponse).json();
  expect(firstPageBody.data.findings.edges).toHaveLength(50);
  expect(firstPageBody.data.findings.totalCount).toBe(236_653);
  const firstPageBytes = Buffer.byteLength(JSON.stringify(firstPageBody));
  await expect(page.getByRole("table", { name: "Vulnerability findings" })).toBeVisible();

  const nextPageResponse = waitForGraphql(
    page,
    "ExploreFindings",
    (variables) => typeof variables.after === "string",
  );
  await page.getByRole("button", { name: "Load more" }).click();
  const nextPageBody = await (await nextPageResponse).json();
  const firstIds = new Set(
    firstPageBody.data.findings.edges.map((edge: { node: { id: string } }) => edge.node.id),
  );
  expect(
    nextPageBody.data.findings.edges.some((edge: { node: { id: string } }) =>
      firstIds.has(edge.node.id),
    ),
  ).toBe(false);

  const windowedResponse = waitForGraphql(
    page,
    "ExploreFindings",
    (variables) =>
      (variables.timeRange as { preset?: string } | undefined)?.preset === "LAST_7_DAYS",
  );
  await page.getByRole("radio", { name: "Last 7 days" }).focus();
  await page.keyboard.press("Enter");
  await windowedResponse;
  await expect(page).toHaveURL(/range=7d/);

  const liveResponse = waitForGraphql(
    page,
    "ExploreFindings",
    (variables) => (variables.timeRange as { preset?: string } | undefined)?.preset === "LIVE",
  );
  await page.getByRole("radio", { name: "Live" }).focus();
  await page.keyboard.press("Enter");
  await liveResponse;

  const searchResponse = waitForGraphql(
    page,
    "ExploreFindings",
    (variables) => variables.search === "CVE-2013-4235" && variables.after == null,
  );
  await page
    .getByRole("combobox", { name: "Search CVE, package, image, or repository" })
    .fill("CVE-2013-4235");
  const searchBody = await (await searchResponse).json();
  expect(searchBody.data.findings.edges.length).toBeLessThanOrEqual(50);

  const row = page.getByRole("row").filter({ hasText: "CVE-2013-4235" });
  await expect(row).toBeVisible();
  const detailResponse = waitForGraphql(page, "FindingDetail");
  await row.focus();
  await page.keyboard.press("Enter");
  const detailBody = await (await detailResponse).json();
  expect(detailBody.data.finding.cve).toBe("CVE-2013-4235");
  await expect(page.getByRole("heading", { name: "CVE-2013-4235" })).toBeVisible();

  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByRole("main")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  expect(overviewBytes).toBeLessThan(50_000);
  expect(firstPageBytes).toBeLessThan(100_000);
  expect(consoleErrors).toEqual([]);
});
