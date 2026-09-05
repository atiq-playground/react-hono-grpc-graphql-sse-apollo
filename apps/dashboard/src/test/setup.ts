import "@testing-library/jest-dom";

Object.defineProperty(globalThis, "ResizeObserver", {
  configurable: true,
  writable: true,
  value: class ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  },
});

Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
  configurable: true,
  value: () => undefined,
});
