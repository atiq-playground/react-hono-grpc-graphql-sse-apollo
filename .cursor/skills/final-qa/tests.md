# Final QA Test Examples

## Jest: contract behavior

Test validated public behavior with a small fixture:

```typescript
test("rejects a manifest that references a missing query chunk", () => {
  const result = parseDatasetManifest({
    version: "2026-08-17",
    queryChunks: [{ key: "query/0001.json" }],
    objects: [],
  });

  expect(result.success).toBe(false);
});
```

## React Testing Library: accessible integration

Drive the route through user-visible controls:

```typescript
test("recovers from invalid stored preferences", async () => {
  localStorage.setItem("dashboard-preferences", "{invalid");
  render(<DashboardRoute />);

  expect(await screen.findByRole("grid")).toBeVisible();
  expect(screen.getByRole("status")).toHaveTextContent(/default preferences/i);
});
```

## Playwright: critical browser journey

Keep journeys cross-boundary and user-centered:

```typescript
test("filters records and opens record detail", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("combobox", { name: /severity/i }).selectOption("high");
  await page.getByRole("gridcell", { name: /package/i }).first().click();

  await expect(page.getByRole("heading", { name: /record detail/i })).toBeVisible();
});
```

## Avoid

- tests coupled to private functions or internal call counts;
- snapshots that hide important semantics;
- fixtures copied wholesale from the raw source;
- duplicated assertions at every test level;
- tests added only to raise a coverage percentage;
- browser tests for behavior that a stable lower-level seam proves more clearly.
