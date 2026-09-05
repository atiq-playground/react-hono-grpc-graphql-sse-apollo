/// <reference types="jest" />
/// <reference types="@testing-library/jest-dom" />

import { fireEvent, render, screen } from "@testing-library/react";

import { ComparePage } from "./compare";

const refetch = jest.fn();
let initialSearch = "";

jest.mock("react-router", () => {
  const { useState } = jest.requireActual<typeof import("react")>("react");
  return {
    useSearchParams: () => {
      const [params, setParams] = useState(() => new URLSearchParams(initialSearch));
      return [
        params,
        (next: string) => {
          setParams(new URLSearchParams(next));
        },
      ];
    },
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
  };
});

jest.mock("../features/compare/use-compare-analysis", () => ({
  useCompareAnalysis: (
    _filters: unknown,
    _timeRange: unknown,
    _left: unknown,
    _right: unknown,
    enabled: boolean,
  ) => ({
    data: enabled
      ? {
          left: { totalCount: 10 },
          right: { totalCount: 12 },
          leftFacets: {
            severity: [{ value: "critical", count: 4 }],
            kaiStatus: [{ value: "invalid - norisk", count: 0 }],
          },
          rightFacets: {
            severity: [{ value: "critical", count: 6 }],
            kaiStatus: [{ value: "ai-invalid-norisk", count: 0 }],
          },
        }
      : undefined,
    dataState: enabled ? "complete" : "empty",
    loading: false,
    error: undefined,
    refetch,
  }),
}));

jest.mock("../features/time-range/TimeRangeFilter", () => ({
  TimeRangeFilter: () => <div>time range</div>,
}));

describe("ComparePage", () => {
  beforeEach(() => {
    initialSearch = "";
  });

  it("keeps results hidden until Compare is selected", () => {
    render(<ComparePage />);

    expect(screen.getByRole("button", { name: "Compare" })).toBeEnabled();
    expect(
      screen.getByRole("heading", { name: "Choose two analysis modes, then Compare" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Finding totals" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Compare" }));

    expect(screen.getByRole("heading", { name: "Finding totals" })).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader", { name: "Analysis" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("columnheader", { name: "AI Analysis" }).length).toBeGreaterThan(0);
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getAllByText("+2").length).toBeGreaterThan(0);
  });

  it("blocks Compare when both sides use the same mode", () => {
    initialSearch = "left=analysis&right=analysis";
    render(<ComparePage />);

    expect(screen.getByRole("button", { name: "Compare" })).toBeDisabled();
    expect(screen.getByText("Choose two different analysis modes.")).toBeInTheDocument();
  });
});
