import { Cache, getPreferenceValues } from "@raycast/api";
import type { AddonManifestInfo, ResolvedStream, StreamObject } from "./types";

const CINEMETA_MANIFEST_URL = "https://v3-cinemeta.strem.io/manifest.json";
const TORRENTIO_MANIFEST_URL = "https://torrentio.strem.fun/manifest.json";

const MANIFEST_CACHE_TTL_SECONDS = 24 * 60 * 60;
const STREAM_CACHE_TTL_SECONDS = 60;

const cache = new Cache({ namespace: "stremio-addons" });

interface ManifestEnvelope {
  id: string;
  name: string;
  types?: string[];
  resources?: string[];
  catalogs?: { type: string; id: string; name?: string }[];
}

async function fetchJson<T>(url: string, timeoutMs = 8000): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`Addon request failed (${response.status}) for ${url}`);
  }
  return (await response.json()) as T;
}

async function cached<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit) {
    let parsed: { t: number; d: T } | null = null;
    try {
      parsed = JSON.parse(hit) as { t: number; d: T };
    } catch {
      parsed = null;
    }
    if (parsed && Date.now() - parsed.t < ttlSeconds * 1000) {
      return parsed.d;
    }
  }
  const value = await loader();
  cache.set(key, JSON.stringify({ t: Date.now(), d: value }));
  return value;
}

function baseUrlFromManifestUrl(manifestUrl: string): string {
  const slash = manifestUrl.lastIndexOf("/");
  return slash === -1 ? manifestUrl : manifestUrl.slice(0, slash);
}

/**
 * Built-in catalog/stream addons shipped with the extension, plus any extra
 * manifest URLs the user added in the preferences.
 */
export async function getConfiguredManifestUrls(): Promise<string[]> {
  const { addonManifests } = getPreferenceValues<{ addonManifests?: string }>();
  const extra = (addonManifests ?? "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
  const seen = new Set<string>([CINEMETA_MANIFEST_URL, TORRENTIO_MANIFEST_URL, ...extra]);
  return [...seen];
}

/**
 * Loads every configured addon manifest (cached). Cinemeta and a public Torrentio
 * instance ship by default so the extension works out of the box.
 */
export async function loadAddonManifests(): Promise<AddonManifestInfo[]> {
  const urls = await getConfiguredManifestUrls();
  const results = await Promise.allSettled(
    urls.map((url) => cached(`manifest:${url}`, MANIFEST_CACHE_TTL_SECONDS, () => fetchJson<ManifestEnvelope>(url))),
  );
  const addons: AddonManifestInfo[] = [];
  for (let index = 0; index < results.length; index++) {
    const result = results[index];
    if (result.status === "fulfilled") {
      const envelope = result.value;
      addons.push({
        baseUrl: baseUrlFromManifestUrl(urls[index]),
        catalogs: [],
        id: envelope.id,
        name: envelope.name ?? "Untitled addon",
        resources: envelope.resources,
        types: envelope.types,
      });
    }
  }
  return addons;
}

function resourceNames(resources?: AddonManifestInfo["resources"]): string[] {
  if (!resources) {
    return [];
  }
  return resources.map((resource) => (typeof resource === "string" ? resource : resource.name));
}

function addonSupportsStream(addon: AddonManifestInfo): boolean {
  return resourceNames(addon.resources).includes("stream");
}

/**
 * Queries every stream-capable addon for the streams of a given id / videoId,
 * and enriches the raw stream objects with parseable quality / size / seeders / provider.
 */
export async function resolveStreams(type: string, id: string, videoId?: string): Promise<ResolvedStream[]> {
  const target = videoId ?? id;
  const manifests = await loadAddonManifests();
  const streamAddons = manifests.filter(addonSupportsStream);

  const results = await Promise.allSettled(
    streamAddons.map((addon) =>
      cached(`streams:${addon.id}:${type}:${target}`, STREAM_CACHE_TTL_SECONDS, async () => {
        const response = await fetchJson<{ streams?: StreamObject[] }>(
          `${addon.baseUrl}/stream/${type}/${encodeURIComponent(target)}.json`,
          10000,
        );
        return (response.streams ?? []).map((stream) => enrichStream(addon.name, stream));
      }),
    ),
  );

  const resolved: ResolvedStream[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      resolved.push(...result.value);
    }
  }
  return dedupeStreams(resolved);
}

const KNOWN_QUALITIES = new Set(["4k", "1080p", "720p", "480p", "360p", "hd", "sd", "uhd"]);
const QUALITY_PRIORITY: Record<string, number> = {
  "4k": 5,
  uhd: 5,
  "1080p": 4,
  hd: 4,
  "720p": 3,
  "480p": 2,
  sd: 2,
  "360p": 1,
};
const VIDEO_SIZE_PATTERN = /([0-9]+(?:\.[0-9]+)?)\s*(MB|GB|TB)/i;
const PROVIDER_PATTERN = /(?:ThePirateBay|TorrentGalaxy|1337x|RARBG|NZBgeek|Bitlake|Orion)/;
const SEEDER_PATTERN = /(?:(?:seeders?|peers?|leechers?)\s*[:=]?\s*([0-9]{1,6})|\b([0-9]{1,6})\s*(?:seeders?|peers?))/i;
const TORRENTIO_SEEDER_PATTERN = /\?\?\s*([0-9]{1,6})\s*\?\?/i;

export function enrichStream(addonName: string, stream: StreamObject): ResolvedStream {
  const title = stream.title ?? "";
  const bingeGroup = stream.behaviorHints?.bingeGroup ?? "";
  const text = `${stream.name ?? ""} ${title} ${bingeGroup}`.toLowerCase();

  let quality = "";
  const qualityCandidates = bingeGroup
    .split("|")
    .map((t) => t.trim().toLowerCase())
    .filter((t) => KNOWN_QUALITIES.has(t));
  if (qualityCandidates.length) {
    quality = qualityCandidates[0];
  } else {
    quality = detectQuality(text);
  }

  const parsed: ResolvedStream = {
    ...stream,
    sourceAddon: addonName,
    quality,
    sizeBytes: behaviorHintsSize(stream) ?? parseSizeBytes(title),
    seeders: parseSeeders(title) ?? parseSeeders(bingeGroup),
    provider: parseProvider(title) ?? stream.sources?.[0] ?? null,
  };
  return parsed;
}

function detectQuality(text: string): string {
  let best = "";
  let bestRank = -1;
  for (const token of Object.keys(QUALITY_PRIORITY)) {
    const re = new RegExp(`\\b${token}\\b`, "i");
    if (re.test(text) && QUALITY_PRIORITY[token] > bestRank) {
      best = token;
      bestRank = QUALITY_PRIORITY[token];
    }
  }
  return best;
}

function behaviorHintsSize(stream: StreamObject): number | null {
  return stream.behaviorHints?.videoSize ?? null;
}

export function parseSizeBytes(text?: string): number | null {
  if (!text) {
    return null;
  }
  const match = text.match(VIDEO_SIZE_PATTERN);
  if (!match) {
    return null;
  }
  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  const multipliers: Record<string, number> = {
    B: 1,
    KB: 1024,
    MB: 1024 ** 2,
    GB: 1024 ** 3,
    TB: 1024 ** 4,
  };
  const multiplier = multipliers[unit];
  if (Number.isNaN(value) || !multiplier) {
    return null;
  }
  return Math.round(value * multiplier);
}

export function parseSeeders(text?: string): number | null {
  if (!text) {
    return null;
  }
  const torrentioMatch = text.match(TORRENTIO_SEEDER_PATTERN);
  if (torrentioMatch) {
    return Number.parseInt(torrentioMatch[1], 10);
  }
  const match = text.match(SEEDER_PATTERN);
  if (!match) {
    return null;
  }
  return Number.parseInt(match[1] ?? match[2], 10);
}

export function parseProvider(text?: string): string | null {
  if (!text) {
    return null;
  }
  const match = PROVIDER_PATTERN.exec(text);
  return match ? match[0] : null;
}

function dedupeStreams(streams: ResolvedStream[]): ResolvedStream[] {
  const seen = new Set<string>();
  return streams.filter((stream) => {
    const key = stream.infoHash ? `${stream.infoHash}:${stream.fileIdx ?? 0}` : (stream.url ?? stream.title ?? "");
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
