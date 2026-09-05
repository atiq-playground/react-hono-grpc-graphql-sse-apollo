import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { ApolloProvider } from "@apollo/client/react";
import { type ReactNode, useState } from "react";
import { createDashboardStore } from "../state/dashboard-store";
import { StoreContext, ThemeContext } from "./dashboard-context";

const PREFS_KEY = "svd.prefs.v1";

type Prefs = { theme: "light" | "dark" };

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { theme: "light" };
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "theme" in parsed &&
      ((parsed as Prefs).theme === "light" || (parsed as Prefs).theme === "dark")
    ) {
      return { theme: (parsed as Prefs).theme };
    }
  } catch {
    // recover to defaults
  }
  return { theme: "light" };
}

const GRAPHQL_TIMEOUT_MS = 30_000;

const client = new ApolloClient({
  link: new HttpLink({
    uri: "/graphql",
    fetch: (input, init) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), GRAPHQL_TIMEOUT_MS);
      const signal = init?.signal;
      if (signal) {
        if (signal.aborted) controller.abort();
        else signal.addEventListener("abort", () => controller.abort(), { once: true });
      }
      return fetch(input, { ...init, signal: controller.signal }).finally(() => {
        clearTimeout(timer);
      });
    },
  }),
  cache: new InMemoryCache(),
});

export function AppProviders({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs());
  const [store] = useState(() => createDashboardStore());

  const setTheme = (theme: "light" | "dark") => {
    const next = { theme };
    setPrefs(next);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      // ignore quota / private mode
    }
    document.documentElement.dataset.theme = theme;
  };

  return (
    <ApolloProvider client={client}>
      <ThemeContext.Provider value={{ theme: prefs.theme, setTheme }}>
        <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
      </ThemeContext.Provider>
    </ApolloProvider>
  );
}
