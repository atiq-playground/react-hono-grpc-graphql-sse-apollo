import { Command, CommandGroup, CommandItem, CommandList } from "@repo/ui/components/ui/command";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import type {
  SearchSuggestionField,
  SearchSuggestionsQuery,
} from "../../graphql/__generated__/graphql";
import { SEARCH_SUGGESTION_LIMIT, useSearchSuggestions } from "./use-search-suggestions";

type SearchSuggestion = SearchSuggestionsQuery["searchSuggestions"][number];

const SUGGESTION_FIELD_ORDER = [
  "CVE",
  "PACKAGE_NAME",
  "IMAGE",
  "REPO",
] as const satisfies readonly SearchSuggestionField[];

const SUGGESTION_FIELD_LABELS: Readonly<Record<SearchSuggestionField, string>> = {
  CVE: "CVE",
  PACKAGE_NAME: "Package",
  IMAGE: "Image",
  REPO: "Repository",
};

type Props = {
  id: string;
  value: string;
  onValueChange: (value: string) => void;
  onCommit: (value: string) => void;
};

function suggestionKey(suggestion: Pick<SearchSuggestion, "field" | "value">): string {
  return `${suggestion.field}:${suggestion.value}`;
}

function groupSuggestions(
  items: readonly SearchSuggestion[],
): readonly { field: SearchSuggestionField; label: string; items: readonly SearchSuggestion[] }[] {
  return SUGGESTION_FIELD_ORDER.flatMap((field) => {
    const grouped = items.filter((item) => item.field === field);
    return grouped.length === 0
      ? []
      : [{ field, label: SUGGESTION_FIELD_LABELS[field], items: grouped }];
  });
}

export function SearchSuggestionsField({ id, value, onValueChange, onCommit }: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const query = useSearchSuggestions(value, SEARCH_SUGGESTION_LIMIT);
  const suggestions = query.data?.searchSuggestions ?? query.previousData?.searchSuggestions ?? [];
  const groups = useMemo(() => groupSuggestions(suggestions), [suggestions]);
  const flatKeys = useMemo(
    () => suggestions.map((suggestion) => suggestionKey(suggestion)),
    [suggestions],
  );
  const trimmed = value.trim();
  const panelOpen = isOpen && trimmed.length > 0;
  const isInitialLoading = query.loading && suggestions.length === 0;
  const status = query.error
    ? "Suggestions are temporarily unavailable."
    : isInitialLoading
      ? "Loading suggestions."
      : suggestions.length === 0 && !query.loading
        ? "No matching CVE, package, image, or repository."
        : query.loading
          ? "Updating suggestions."
          : `${suggestions.length} suggestions.`;

  useEffect(() => {
    if (flatKeys.length === 0) {
      setActiveKey(null);
      return;
    }
    setActiveKey((current) =>
      current !== null && flatKeys.includes(current) ? current : (flatKeys[0] ?? null),
    );
  }, [flatKeys]);

  useEffect(() => {
    if (!panelOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setIsOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [panelOpen]);

  const applySuggestion = (suggestion: SearchSuggestion) => {
    onValueChange(suggestion.value);
    onCommit(suggestion.value);
    setIsOpen(false);
  };

  const moveActive = (delta: number) => {
    if (flatKeys.length === 0) return;
    const currentIndex = activeKey === null ? -1 : flatKeys.indexOf(activeKey);
    const nextIndex =
      currentIndex === -1
        ? delta > 0
          ? 0
          : flatKeys.length - 1
        : (currentIndex + delta + flatKeys.length) % flatKeys.length;
    setActiveKey(flatKeys[nextIndex] ?? null);
  };

  return (
    <div ref={rootRef} className="relative min-w-64 flex-1 space-y-1">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        Search CVE, package, image, or repository
      </Label>
      <Input
        id={id}
        type="search"
        role="combobox"
        value={value}
        maxLength={256}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        aria-autocomplete="list"
        aria-expanded={panelOpen}
        aria-controls={listId}
        aria-activedescendant={panelOpen && activeKey ? `${listId}-${activeKey}` : undefined}
        onFocus={() => setIsOpen(true)}
        onChange={(event) => {
          onValueChange(event.target.value);
          setIsOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setIsOpen(true);
            moveActive(1);
            return;
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setIsOpen(true);
            moveActive(-1);
            return;
          }
          if (event.key === "Enter" && panelOpen) {
            const selected = suggestions.find((item) => suggestionKey(item) === activeKey);
            if (selected) {
              event.preventDefault();
              applySuggestion(selected);
            }
            return;
          }
          if (event.key === "Escape" && panelOpen) {
            event.preventDefault();
            setIsOpen(false);
          }
        }}
      />
      {panelOpen && (
        <div className="absolute top-full z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
          <Command
            shouldFilter={false}
            value={activeKey ?? ""}
            onValueChange={(next) => {
              if (next.length > 0) setActiveKey(next);
            }}
            className="bg-transparent"
          >
            <CommandList id={listId} aria-label="Search suggestions">
              {groups.map((group) => (
                <CommandGroup key={group.field} heading={group.label}>
                  {group.items.map((item) => {
                    const key = suggestionKey(item);
                    return (
                      <CommandItem
                        key={key}
                        id={`${listId}-${key}`}
                        value={key}
                        onMouseDown={(event) => event.preventDefault()}
                        onSelect={() => applySuggestion(item)}
                      >
                        <span className="min-w-0 flex-1 truncate">{item.value}</span>
                        <span className="text-muted-foreground text-xs">{group.label}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
          <p className="text-muted-foreground border-t px-2 py-1.5 text-xs" role="status">
            {status}
          </p>
        </div>
      )}
    </div>
  );
}
