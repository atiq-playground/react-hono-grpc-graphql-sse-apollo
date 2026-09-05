import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { ApolloProvider } from "@apollo/client/react";
import { createContext, type ReactNode, useContext, useMemo, useState } from "react";
import { createDashboardStore, type DashboardStore } from "../state/dashboard-store";

const StoreContext = createContext<DashboardStore | null>(null);
const ThemeContext = createContext<{
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
}>({ theme: "light", setTheme: () => undefined });

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

function createApollo() {
  return new ApolloClient({
    link: new HttpLink({ uri: "/graphql" }),
    cache: new InMemoryCache(),
  });
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs());
  const store = useMemo(() => createDashboardStore(), []);
  const client = useMemo(() => createApollo(), []);

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

export function useDashboardStore(): DashboardStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error("Dashboard store missing");
  return store;
}

export function useTheme() {
  return useContext(ThemeContext);
}
