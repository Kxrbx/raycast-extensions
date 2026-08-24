import { Cache } from "@raycast/api";

const RECENTS_KEY = "recent-searches";
const RECENTS_LIMIT = 8;

const cache = new Cache({ namespace: "stremio-search" });

export function getRecentSearches(): string[] {
  const raw = cache.get(RECENTS_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

export function addRecentSearch(query: string): void {
  const trimmed = query.trim();
  if (!trimmed) {
    return;
  }
  const next = [trimmed, ...getRecentSearches().filter((entry) => entry.toLowerCase() !== trimmed.toLowerCase())];
  cache.set(RECENTS_KEY, JSON.stringify(next.slice(0, RECENTS_LIMIT)));
}

export function removeRecentSearch(query: string): void {
  const next = getRecentSearches().filter((entry) => entry !== query);
  cache.set(RECENTS_KEY, JSON.stringify(next));
}

export function clearRecentSearches(): void {
  cache.remove(RECENTS_KEY);
}
