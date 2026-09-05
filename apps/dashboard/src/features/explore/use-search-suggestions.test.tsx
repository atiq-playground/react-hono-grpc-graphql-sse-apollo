/// <reference types="jest" />

import { ApolloClient, ApolloLink, InMemoryCache, Observable } from "@apollo/client";
import { ApolloProvider } from "@apollo/client/react";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";

import {
  SEARCH_SUGGESTION_DEBOUNCE_MS,
  suggestionQueryPrefix,
  useSearchSuggestions,
} from "./use-search-suggestions";

describe("suggestionQueryPrefix", () => {
  it("skips empty and whitespace-settled prefixes", () => {
    expect(suggestionQueryPrefix("", "")).toBe("");
    expect(suggestionQueryPrefix("", "cve")).toBe("");
    expect(suggestionQueryPrefix("cve", "")).toBe("");
  });

  it("queries only after debounce settles, and keeps the last prefix while extending", () => {
    expect(suggestionQueryPrefix("cve", "cve")).toBe("cve");
    expect(suggestionQueryPrefix("cve-2024", "cve")).toBe("cve");
  });

  it("skips a stale prefix after clear or replace", () => {
    expect(suggestionQueryPrefix("openssl", "cve")).toBe("");
    expect(suggestionQueryPrefix("cv", "cve")).toBe("");
  });
});

function createRecordingWrapper() {
  const prefixes: string[] = [];
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new ApolloLink((operation) => {
      prefixes.push(String(operation.variables.prefix));
      return new Observable((observer) => {
        observer.next({ data: { searchSuggestions: [] } });
        observer.complete();
      });
    }),
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return <ApolloProvider client={client}>{children}</ApolloProvider>;
  }
  return { prefixes, Wrapper };
}

describe("useSearchSuggestions debounce", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
  });

  it("does not query on every keystroke and skips empty prefixes", () => {
    const { prefixes, Wrapper } = createRecordingWrapper();
    const { rerender } = renderHook(({ prefix }) => useSearchSuggestions(prefix), {
      wrapper: Wrapper,
      initialProps: { prefix: "" },
    });

    expect(prefixes).toEqual([]);

    rerender({ prefix: " c " });
    rerender({ prefix: "cv" });
    rerender({ prefix: "cve" });
    act(() => {
      jest.advanceTimersByTime(SEARCH_SUGGESTION_DEBOUNCE_MS - 1);
    });
    expect(prefixes).toEqual([]);

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(prefixes).toEqual(["cve"]);

    rerender({ prefix: "cve-2" });
    act(() => {
      jest.advanceTimersByTime(SEARCH_SUGGESTION_DEBOUNCE_MS - 1);
    });
    expect(prefixes).toEqual(["cve"]);

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(prefixes).toEqual(["cve", "cve-2"]);

    rerender({ prefix: "   " });
    expect(prefixes).toEqual(["cve", "cve-2"]);

    rerender({ prefix: "openssl" });
    expect(prefixes).toEqual(["cve", "cve-2"]);

    act(() => {
      jest.advanceTimersByTime(SEARCH_SUGGESTION_DEBOUNCE_MS);
    });
    expect(prefixes).toEqual(["cve", "cve-2", "openssl"]);
  });
});
