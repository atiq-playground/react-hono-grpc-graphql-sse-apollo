import { createContext, useContext } from "react";
import type { DashboardStore } from "../state/dashboard-store";

export const StoreContext = createContext<DashboardStore | null>(null);

export const ThemeContext = createContext<{
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
}>({ theme: "light", setTheme: () => undefined });

export function useDashboardStore(): DashboardStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error("Dashboard store missing");
  return store;
}

export function useTheme() {
  return useContext(ThemeContext);
}
