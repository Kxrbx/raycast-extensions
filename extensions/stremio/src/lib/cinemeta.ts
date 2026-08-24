import { Cache } from "@raycast/api";
import type {
  AddonManifest,
  CatalogId,
  CatalogResponse,
  CatalogResult,
  ContentType,
  MetaDetail,
  MetaPreview,
  MetaResponse,
} from "./types";

const CINEMETA_BASE_URL = "https://v3-cinemeta.strem.io";

const MANIFEST_TTL_SECONDS = 7 * 24 * 60 * 60;
const CATALOG_TTL_SECONDS = 30 * 60;
const SEARCH_TTL_SECONDS = 10 * 60;
const META_TTL_SECONDS = 24 * 60 * 60;

export const PAGE_SIZE = 100;

const cache = new Cache({ namespace: "cinemeta" });

interface CacheEntry<T> {
  t: number;
  d: T;
}

async function fetchJson<T>(url: string, timeoutMs = 10000): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`Cinemeta request failed (HTTP ${response.status})`);
  }
  return (await response.json()) as T;
}

async function cachedJson<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit) {
    let parsed: CacheEntry<T> | null = null;
    try {
      parsed = JSON.parse(hit) as CacheEntry<T>;
    } catch {
      parsed = null;
    }
    if (parsed && Date.now() - parsed.t < ttlSeconds * 1000) {
      return parsed.d;
    }
  }
  const data = await loader();
  cache.set(key, JSON.stringify({ t: Date.now(), d: data }));
  return data;
}

export function catalogUrl(
  type: ContentType,
  catalogId: CatalogId,
  extras: Record<string, string | number | undefined>,
): string {
  const parts: string[] = [];
  for (const [name, value] of Object.entries(extras)) {
    if (value === undefined || value === "") {
      continue;
    }
    parts.push(`${name}=${encodeURIComponent(String(value))}`);
  }
  const extraArgs = parts.length > 0 ? `/${parts.join("&")}` : "";
  return `${CINEMETA_BASE_URL}/catalog/${type}/${catalogId}${extraArgs}.json`;
}

/** The official Cinemeta addon manifest, describing available catalogs and their genres. */
export async function getCinemetaManifest(): Promise<AddonManifest> {
  return cachedJson("manifest", MANIFEST_TTL_SECONDS, () =>
    fetchJson<AddonManifest>(`${CINEMETA_BASE_URL}/manifest.json`),
  );
}

/** Genre options of a catalog ("year" catalog exposes years instead of genres). */
export async function getCatalogFilterOptions(type: ContentType, catalogId: CatalogId): Promise<string[]> {
  const manifest = await getCinemetaManifest();
  const catalog = manifest.catalogs?.find((c) => c.type === type && c.id === catalogId);
  const genreExtra = catalog?.extra?.find((e) => e.name === "genre");
  if (genreExtra?.options && genreExtra.options.length > 0) {
    return genreExtra.options;
  }
  return catalog?.genres ?? [];
}

/**
 * Searches movies and series. `type` may be "all" to query both content types.
 * An optional genre is applied server-side when supported by the catalog.
 */
export async function searchContent(
  query: string,
  type: ContentType | "all",
  skip = 0,
  genre = "",
): Promise<MetaPreview[]> {
  const types: ContentType[] = type === "all" ? ["movie", "series"] : [type];
  const results = await Promise.all(
    types.map(async (contentType) => {
      const key = `search:${contentType}:${skip}:${genre}:${query.toLowerCase()}`;
      return cachedJson(key, SEARCH_TTL_SECONDS, async () => {
        const response = await fetchJson<CatalogResponse>(
          catalogUrl(contentType, "top", { search: query, genre, skip }),
        );
        return response.metas ?? [];
      });
    }),
  );
  const seen = new Set<string>();
  const merged: MetaPreview[] = [];
  for (const metas of results) {
    for (const meta of metas) {
      if (!seen.has(meta.id)) {
        seen.add(meta.id);
        merged.push(meta);
      }
    }
  }
  return merged;
}

/**
 * Fetches one page of a catalog. For the "year" catalog a genre (a year) is required.
 */
export async function getCatalog(
  type: ContentType,
  catalogId: CatalogId,
  options?: { genre?: string; skip?: number },
): Promise<CatalogResult> {
  const genre = options?.genre ?? "";
  const skip = options?.skip ?? 0;
  let effectiveGenre = genre;
  if (catalogId === "year" && !effectiveGenre) {
    effectiveGenre = String(new Date().getFullYear());
  }
  const key = `catalog:${type}:${catalogId}:${effectiveGenre}:${skip}`;
  return cachedJson(key, CATALOG_TTL_SECONDS, async () => {
    const response = await fetchJson<CatalogResponse>(catalogUrl(type, catalogId, { genre: effectiveGenre, skip }));
    const count = response.metas?.length ?? 0;
    return { items: response.metas ?? [], hasNextPage: Boolean(response.hasNextPage) || count >= PAGE_SIZE };
  });
}

/** Full metadata for a movie or series, including the episode list for series. */
export async function getMetaDetail(type: ContentType, id: string): Promise<MetaDetail> {
  const key = `meta:${type}:${id}`;
  return cachedJson(key, META_TTL_SECONDS, async () => {
    const response = await fetchJson<MetaResponse>(`${CINEMETA_BASE_URL}/meta/${type}/${encodeURIComponent(id)}.json`);
    if (!response.meta) {
      throw new Error(`No metadata found for ${id}`);
    }
    return response.meta;
  });
}
