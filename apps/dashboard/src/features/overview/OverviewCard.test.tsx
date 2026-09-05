/// <reference types="jest" />
/// <reference types="@testing-library/jest-dom" />

import { render, screen } from "@testing-library/react";

import { OverviewCard } from "./OverviewCard";

jest.mock("react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

const populatedRows = [
  { key: "critical", label: "Critical", value: 4 },
  { key: "high", label: "High", value: 2 },
] as const;

describe("OverviewCard empty chart frame", () => {
  it("keeps the titled chart region and announces No data when there are no rows", () => {
    render(
      <OverviewCard
        title="Severity distribution"
        description="Source records grouped by server-provided severity."
        summary="2 server-aggregated categories."
        rows={[]}
      >
        <div>plotted series</div>
      </OverviewCard>,
    );

    expect(screen.getByRole("heading", { name: "Severity distribution" })).toBeInTheDocument();
    const emptyState = screen.getByRole("status");
    expect(emptyState).toHaveTextContent("No data");
    expect(emptyState.parentElement).toHaveClass("h-56");
    expect(screen.queryByText("View data table")).not.toBeInTheDocument();
  });

  it("announces No data when every series value is zero", () => {
    render(
      <OverviewCard
        title="CVEs found vs fixed"
        description="Server-provided CVE counts in the active published range."
        summary="Found 0 CVEs; fixed 0 CVEs."
        rows={[
          { key: "found", label: "CVEs found", value: 0 },
          { key: "fixed", label: "CVEs fixed", value: 0 },
        ]}
      >
        <div>zero series</div>
      </OverviewCard>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("No data");
    expect(screen.queryByText("View data table")).not.toBeInTheDocument();
  });

  it("renders plotted children when the series has values", () => {
    render(
      <OverviewCard
        title="Severity distribution"
        description="Source records grouped by server-provided severity."
        summary="2 server-aggregated categories."
        rows={populatedRows}
      >
        <div>plotted series</div>
      </OverviewCard>,
    );

    expect(screen.getByText("plotted series")).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "No data" })).not.toBeInTheDocument();
    expect(screen.getByText("View data table")).toBeInTheDocument();
  });
});
