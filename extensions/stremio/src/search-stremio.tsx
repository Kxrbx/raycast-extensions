import { Action, ActionPanel, Icon, List, getPreferenceValues } from "@raycast/api";
import { useEffect, useMemo, useState } from "react";
import { getCatalogFilterOptions, searchContent } from "./lib/cinemeta";
import { useDebouncedValue } from "./lib/hooks";
import { addRecentSearch, clearRecentSearches, getRecentSearches, removeRecentSearch } from "./lib/recents";
import type { ContentFilter, MetaPreview } from "./lib/types";
import { ConfigureExtensionAction } from "./components/actions";
import { MetaListItem } from "./components/meta-list-item";

const SEARCH_DEBOUNCE_MS = 200;

type SortMode = "relevance" | "rating" | "year";

function yearOf(meta: MetaPreview): number {
  return Number.parseInt(meta.releaseInfo?.slice(0, 4) ?? "", 10) || 0;
}

function ratingOf(meta: MetaPreview): number {
  return Number.parseFloat(meta.imdbRating ?? "") || 0;
}

export default function Command() {
  const { defaultContentType } = getPreferenceValues();
  const initialType: ContentFilter =
    defaultContentType === "movie" || defaultContentType === "series" ? defaultContentType : "all";

  const [searchText, setSearchText] = useState("");
  const query = useDebouncedValue(searchText.trim(), SEARCH_DEBOUNCE_MS);
  const [contentType, setContentType] = useState<ContentFilter>(initialType);
  const [genre, setGenre] = useState("");
  const [minRating, setMinRating] = useState(0);
  const [sortMode, setSortMode] = useState<SortMode>("relevance");
  const [filterSelection, setFilterSelection] = useState(`type:${initialType}`);
  const [genreOptions, setGenreOptions] = useState<string[]>([]);
  const [results, setResults] = useState<MetaPreview[]>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [recents, setRecents] = useState<string[]>(() => getRecentSearches());

  const isSearching = Boolean(query);

  useEffect(() => {
    if (contentType === "all") {
      setGenreOptions([]);
      return;
    }
    let cancelled = false;
    getCatalogFilterOptions(contentType, "top")
      .then((options) => {
        if (!cancelled) {
          setGenreOptions(options);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [contentType]);

  useEffect(() => {
    if (!isSearching) {
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(undefined);
    searchContent(query, contentType, 0, contentType === "all" ? "" : genre)
      .then((metas) => {
        if (cancelled) {
          return;
        }
        setResults(metas);
        if (metas.length > 0) {
          addRecentSearch(query);
          setRecents(getRecentSearches());
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [query, contentType, genre, isSearching]);

  const visible = useMemo(() => {
    let items = results ?? [];
    if (minRating > 0) {
      items = items.filter((meta) => ratingOf(meta) >= minRating);
    }
    if (sortMode === "rating") {
      items = [...items].sort((a, b) => ratingOf(b) - ratingOf(a));
    } else if (sortMode === "year") {
      items = [...items].sort((a, b) => yearOf(b) - yearOf(a));
    }
    return items;
  }, [results, minRating, sortMode]);

  const grouped = useMemo(() => {
    const topResult = isSearching && visible.length > 0 ? visible[0] : undefined;
    const rest = visible.filter((meta) => meta !== topResult);
    return {
      topResult,
      movies: rest.filter((meta) => meta.type !== "series"),
      series: rest.filter((meta) => meta.type === "series"),
    };
  }, [visible, isSearching]);

  function applySelection(value: string) {
    setFilterSelection(value);
    const separatorIndex = value.indexOf(":");
    const kind = value.slice(0, separatorIndex);
    const payload = value.slice(separatorIndex + 1);
    if (kind === "type") {
      setContentType(payload === "series" ? "series" : payload === "movie" ? "movie" : "all");
      setGenre("");
    } else if (kind === "genre") {
      setGenre(payload);
    } else if (kind === "rating") {
      setMinRating(Number(payload) || 0);
    } else if (kind === "sort") {
      setSortMode(payload as SortMode);
    }
  }

  const { topResult, movies, series } = grouped;
  const noResults = isSearching && !error && results !== undefined && visible.length === 0;

  return (
    <List
      searchText={searchText}
      onSearchTextChange={setSearchText}
      isLoading={isLoading}
      isShowingDetail
      enableFiltering={false}
      navigationTitle="Search Movies & Series"
      searchBarPlaceholder="Type to search movies & series..."
      searchBarAccessory={
        <List.Dropdown tooltip="Filters" value={filterSelection} onChange={applySelection} storeValue>
          <List.Dropdown.Section title="Type">
            <List.Dropdown.Item title="All" value="type:all" />
            <List.Dropdown.Item title="Movies" value="type:movie" />
            <List.Dropdown.Item title="Series" value="type:series" />
          </List.Dropdown.Section>
          {contentType !== "all" && genreOptions.length > 0 && (
            <List.Dropdown.Section title="Genre">
              <List.Dropdown.Item title="All Genres" value="genre:" />
              {genreOptions.map((option) => (
                <List.Dropdown.Item key={option} title={option} value={`genre:${option}`} />
              ))}
            </List.Dropdown.Section>
          )}
          <List.Dropdown.Section title="Minimum Rating">
            <List.Dropdown.Item title="Any" value="rating:0" />
            <List.Dropdown.Item title="★ 6+" value="rating:6" />
            <List.Dropdown.Item title="★ 7+" value="rating:7" />
            <List.Dropdown.Item title="★ 8+" value="rating:8" />
          </List.Dropdown.Section>
          <List.Dropdown.Section title="Sort By">
            <List.Dropdown.Item title="Relevance" value="sort:relevance" />
            <List.Dropdown.Item title="Rating" value="sort:rating" />
            <List.Dropdown.Item title="Year" value="sort:year" />
          </List.Dropdown.Section>
        </List.Dropdown>
      }
    >
      {!isSearching ? (
        recents.length > 0 ? (
          <List.Section title="Recent Searches">
            {recents.map((recent) => (
              <List.Item
                key={recent}
                icon={Icon.Clock}
                title={recent}
                actions={
                  <ActionPanel>
                    <Action title="Search Again" icon={Icon.MagnifyingGlass} onAction={() => setSearchText(recent)} />
                    <Action
                      title="Remove"
                      icon={Icon.Trash}
                      onAction={() => {
                        removeRecentSearch(recent);
                        setRecents(getRecentSearches());
                      }}
                    />
                    <ConfigureExtensionAction />
                  </ActionPanel>
                }
              />
            ))}
            <List.Item
              icon={Icon.Trash}
              title="Clear Recent Searches"
              actions={
                <ActionPanel>
                  <Action
                    title="Clear"
                    icon={Icon.Trash}
                    onAction={() => {
                      clearRecentSearches();
                      setRecents([]);
                    }}
                  />
                  <ConfigureExtensionAction />
                </ActionPanel>
              }
            />
          </List.Section>
        ) : (
          <List.EmptyView
            icon={Icon.MagnifyingGlass}
            title="Type to search"
            description="Millions of movies & series — play streams in VLC, mpv or Stremio."
          />
        )
      ) : error ? (
        <List.EmptyView title="Something went wrong" description={error} />
      ) : noResults ? (
        <List.EmptyView title={`No results for "${query}"`} description="Try a different search or filter." />
      ) : (
        <>
          {topResult && (
            <List.Section title="Top Result">
              <MetaListItem meta={topResult} id="top-result" />
            </List.Section>
          )}
          {contentType === "all" ? (
            <>
              {movies.length > 0 && (
                <List.Section title="Movies" subtitle={`${movies.length}`}>
                  {movies.map((meta) => (
                    <MetaListItem key={meta.id} meta={meta} />
                  ))}
                </List.Section>
              )}
              {series.length > 0 && (
                <List.Section title="Series" subtitle={`${series.length}`}>
                  {series.map((meta) => (
                    <MetaListItem key={meta.id} meta={meta} />
                  ))}
                </List.Section>
              )}
            </>
          ) : (
            <List.Section title="Results" subtitle={`${visible.length}`}>
              {visible.map((meta) => (
                <MetaListItem key={meta.id} meta={meta} />
              ))}
            </List.Section>
          )}
        </>
      )}
    </List>
  );
}
