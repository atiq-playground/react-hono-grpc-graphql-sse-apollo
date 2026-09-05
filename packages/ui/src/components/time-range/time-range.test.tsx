/// <reference types="jest" />
/// <reference types="@testing-library/jest-dom" />

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { TimeRange } from "./time-range";
import type { TimeRangeValue } from "./time-range.types";

const presets = [
  { value: "live", label: "Live" },
  { value: "7d", label: "7d", ariaLabel: "Last 7 days" },
  { value: "custom", label: "Custom", ariaLabel: "Custom relative time" },
] as const;

function activateFromKeyboard(element: HTMLElement): void {
  fireEvent.keyDown(element, { key: "Enter", code: "Enter" });
  fireEvent.click(element, { detail: 0 });
  fireEvent.keyUp(element, { key: "Enter", code: "Enter" });
}

function ControlledHarness() {
  const [value, setValue] = useState<TimeRangeValue>({ preset: "live" });
  return (
    <TimeRange.Root
      value={value}
      onValueChange={setValue}
      formatDate={(date) => date.toISOString()}
    >
      <TimeRange.Presets presets={presets} aria-label="Time presets" />
      <TimeRange.Custom numberOfMonths={1} />
    </TimeRange.Root>
  );
}

describe("TimeRange compound control", () => {
  it("selects presets from the keyboard and announces controlled changes", async () => {
    render(<ControlledHarness />);
    const live = screen.getByRole("radio", { name: "Live" });
    const sevenDays = screen.getByRole("radio", { name: "Last 7 days" });
    expect(sevenDays).toHaveTextContent("7d");

    act(() => live.focus());
    fireEvent.keyDown(live, { key: "ArrowRight", code: "ArrowRight" });
    await waitFor(() => expect(sevenDays).toHaveFocus());
    activateFromKeyboard(sevenDays);

    expect(sevenDays).toHaveAttribute("data-state", "on");
    await waitFor(() => {
      expect(screen.getByText("Time range: Last 7 days")).toHaveAttribute("aria-live", "polite");
    });
  });

  it("does not mutate a controlled value until its owner supplies the next value", () => {
    const onValueChange = jest.fn();
    const { rerender } = render(
      <TimeRange.Root value={{ preset: "live" }} onValueChange={onValueChange}>
        <TimeRange.Presets presets={presets} />
      </TimeRange.Root>,
    );

    fireEvent.click(screen.getByRole("radio", { name: "Last 7 days" }));
    expect(onValueChange).toHaveBeenCalledWith({
      preset: "7d",
      from: undefined,
      to: undefined,
    });
    expect(screen.getByRole("radio", { name: "Live" })).toHaveAttribute("data-state", "on");

    rerender(
      <TimeRange.Root value={{ preset: "7d" }} onValueChange={onValueChange}>
        <TimeRange.Presets presets={presets} />
      </TimeRange.Root>,
    );
    expect(screen.getByRole("radio", { name: "Last 7 days" })).toHaveAttribute("data-state", "on");
  });

  it("reflects applied and cleared custom ranges from its controlled owner", () => {
    const initialFrom = new Date(2026, 8, 1);
    const initialTo = new Date(2026, 8, 2);
    const formatDate = (date: Date) =>
      `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date
        .getDate()
        .toString()
        .padStart(2, "0")}`;
    const { rerender } = render(
      <TimeRange.Root
        value={{ preset: "custom", from: initialFrom, to: initialTo }}
        formatDate={formatDate}
      >
        <TimeRange.Presets presets={presets} />
        <TimeRange.Custom numberOfMonths={1} />
      </TimeRange.Root>,
    );

    const custom = screen.getByRole("radio", { name: "Custom relative time" });
    expect(custom).toHaveTextContent("Custom");
    expect(custom).toHaveAttribute("data-state", "on");
    expect(screen.queryByRole("button", { name: /Select dates|Custom range:/ })).toBeNull();
    expect(screen.getByText("2 days")).toBeVisible();
    expect(screen.getByText(/custom, 2026-09-01 to 2026-09-02/)).toHaveAttribute(
      "aria-live",
      "polite",
    );

    rerender(
      <TimeRange.Root value={{ preset: "custom" }} formatDate={formatDate}>
        <TimeRange.Presets presets={presets} />
        <TimeRange.Custom numberOfMonths={1} />
      </TimeRange.Root>,
    );
    expect(screen.getByRole("radio", { name: "Custom relative time" })).toHaveAttribute(
      "data-state",
      "on",
    );
    expect(screen.queryByRole("button", { name: /Select dates|Custom range:/ })).toBeNull();
    expect(screen.queryByText("2 days")).not.toBeInTheDocument();
    expect(screen.getByText("Time range: custom, no dates applied")).toBeVisible();
  });

  it("opens the calendar from the Custom segment without a second date control", async () => {
    render(<ControlledHarness />);

    fireEvent.click(screen.getByRole("radio", { name: "Custom relative time" }));

    const custom = screen.getByRole("radio", { name: "Custom relative time" });
    expect(custom).toHaveAttribute("data-state", "on");
    expect(custom).toHaveAttribute("aria-expanded", "true");
    expect(custom).toHaveAttribute("aria-haspopup", "dialog");
    expect(screen.queryByRole("button", { name: /Select dates|Custom range:/ })).toBeNull();
    expect(await screen.findByRole("button", { name: "Apply" })).toBeVisible();
    expect(screen.getByRole("grid")).toBeVisible();
  });

  it("reopens the calendar from Custom when a custom range is already applied", async () => {
    render(
      <TimeRange.Root
        value={{ preset: "custom", from: new Date(2026, 8, 1), to: new Date(2026, 8, 2) }}
      >
        <TimeRange.Presets presets={presets} />
        <TimeRange.Custom numberOfMonths={1} />
      </TimeRange.Root>,
    );

    const custom = screen.getByRole("radio", { name: "Custom relative time" });
    expect(custom).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();

    fireEvent.click(custom);

    expect(custom).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findByRole("button", { name: "Apply" })).toBeVisible();
    expect(screen.getByRole("grid")).toBeVisible();
  });

  it("opens the calendar when Custom is activated from the keyboard", async () => {
    render(<ControlledHarness />);
    const custom = screen.getByRole("radio", { name: "Custom relative time" });

    act(() => custom.focus());
    expect(custom).toHaveFocus();
    activateFromKeyboard(custom);

    expect(custom).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findByRole("button", { name: "Apply" })).toBeVisible();
  });
});
