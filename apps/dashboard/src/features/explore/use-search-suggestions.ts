import { skipToken, useQuery } from "@apollo/client/react";
import { useEffect, useState } from "react";

import { SearchSuggestionsDocument } from "../../graphql/operations";

export const SEARCH_SUGGESTION_LIMIT = 10;
export const SEARCH_SUGGESTION_DEBOUNCE_MS = 200;

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [delay, value]);
  return debounced;
}

/** Apollo variables after debounce. Empty means skipToken — no gateway call. */
export function suggestionQueryPrefix(normalizedPrefix: string, debouncedPrefix: string): string {
  if (normalizedPrefix.length === 0 || debouncedPrefix.length === 0) return "";
  if (normalizedPrefix === debouncedPrefix || normalizedPrefix.startsWith(debouncedPrefix)) {
    return debouncedPrefix;
  }
  return "";
}

export function useSearchSuggestions(prefix: string, limit = SEARCH_SUGGESTION_LIMIT) {
  const normalizedPrefix = prefix.trim();
  const debouncedPrefix = useDebouncedValue(normalizedPrefix, SEARCH_SUGGESTION_DEBOUNCE_MS);
  const queryPrefix = suggestionQueryPrefix(normalizedPrefix, debouncedPrefix);
  // skipToken and prefix changes unsubscribe the prior Observable; HttpLink aborts it.
  return useQuery(
    SearchSuggestionsDocument,
    queryPrefix.length > 0 ? { variables: { prefix: queryPrefix, limit } } : skipToken,
  );
}
