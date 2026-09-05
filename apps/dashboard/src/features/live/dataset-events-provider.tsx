import type { ReactNode } from "react";
import { useSearchParams } from "react-router";

import { parseExploreSearch } from "../../app/url-state";
import { useDatasetEvents } from "./use-dataset-events";

export function DatasetEventsProvider({ children }: { children: ReactNode }) {
  const [searchParams] = useSearchParams();
  const timeRange = parseExploreSearch(searchParams).timeRange;
  useDatasetEvents(timeRange.preset);
  return children;
}
