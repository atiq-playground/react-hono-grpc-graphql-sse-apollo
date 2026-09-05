/// <reference types="jest" />
/// <reference types="@testing-library/jest-dom" />

import { render, screen } from "@testing-library/react";

import { StoreContext } from "../app/dashboard-context";
import { createDashboardStore } from "../state/dashboard-store";
import { OverviewPage } from "./overview";

jest.mock("react-router", () => ({
  useSearchParams: () => [new URLSearchParams(), jest.fn()],
  useNavigate: () => jest.fn(),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

jest.mock("../features/overview/OverviewToolbar", () => ({
  OverviewToolbar: () => <div>toolbar</div>,
}));

jest.mock("../features/live/use-dataset-events", () => ({
  useRefreshPendingUpdates: () => jest.fn(),
}));

jest.mock("../features/overview/use-vulnerability-overview", () => {
  const emptyOverview = {
    totals: {
      total: 0,
      uniqueCves: 0,
      analysisCount: 0,
      aiAnalysisCount: 0,
      averageCvss: 0,
    },
    severityDistribution: [],
    statusDistribution: [],
    byRepository: [],
    byImage: [],
    topPackages: [],
    riskFactorDistribution: [],
    ageBuckets: [],
    fixAvailability: [],
    cvesFoundVsFixed: { found: 0, fixed: 0 },
    timeToFixBuckets: [],
    publishedTrend: [],
  };
  return {
    useVulnerabilityOverview: () => ({
      data: { vulnerabilityOverview: emptyOverview },
      dataState: "complete",
      loading: false,
      error: undefined,
      refetch: jest.fn(),
    }),
  };
});

const CHART_TITLES = [
  "Published trend",
  "CVEs found vs fixed",
  "Severity distribution",
  "Open and fixed status",
  "Top repositories",
  "Top images",
  "Top packages",
  "Risk-factor distribution",
  "Vulnerability age",
  "Fix availability",
  "Time to fix",
] as const;

function stubBrowserLayoutApis() {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }),
  });
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
}

function renderOverviewPage() {
  stubBrowserLayoutApis();
  render(
    <StoreContext.Provider value={createDashboardStore()}>
      <OverviewPage />
    </StoreContext.Provider>,
  );
}

describe("OverviewPage empty aggregates", () => {
  it("keeps every chart shell with No data instead of collapsing the page", () => {
    renderOverviewPage();

    expect(screen.queryByText("No matching aggregate data")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Aggregate summary" })).toBeInTheDocument();

    for (const title of CHART_TITLES) {
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    }

    expect(
      screen.getAllByRole("status").filter((node) => node.textContent === "No data"),
    ).toHaveLength(CHART_TITLES.length);
  });
});
