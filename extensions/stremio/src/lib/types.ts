export type ContentType = "movie" | "series";

export type ContentFilter = ContentType | "all";

export interface MetaPreview {
  id: string;
  type: string;
  name: string;
  poster?: string;
  background?: string;
  logo?: string;
  description?: string;
  releaseInfo?: string;
  imdbRating?: string;
  genres?: string[];
  runtime?: string;
  popularity?: number;
  trailer?: string;
  trailers?: { source: string; type: string }[];
}

export interface Video {
  id: string;
  name?: string;
  title?: string;
  season?: number;
  episode?: number;
  released?: string;
  overview?: string;
  thumbnail?: string;
  description?: string;
}

export interface MetaDetail extends MetaPreview {
  released?: string;
  country?: string;
  awards?: string;
  cast?: string[];
  director?: string[];
  writer?: string[];
  videos?: Video[];
}

export interface CatalogResponse {
  metas?: MetaPreview[];
  hasNextPage?: boolean;
}

export interface MetaResponse {
  meta?: MetaDetail | null;
}

export interface ManifestExtra {
  name: string;
  isRequired?: boolean;
  options?: string[];
  optionsLimit?: number;
}

export interface ManifestCatalog {
  type: string;
  id: string;
  name?: string;
  genres?: string[];
  extra?: ManifestExtra[];
  extraSupported?: string[];
  extraRequired?: string[];
}

export interface AddonManifest {
  id: string;
  version?: string;
  name?: string;
  description?: string;
  types?: string[];
  catalogs?: ManifestCatalog[];
}

export type CatalogId = "top" | "year" | "imdbRating";

export interface CatalogResult {
  items: MetaPreview[];
  hasNextPage: boolean;
}

export interface ServerStatus {
  online: boolean;
  baseUrl: string;
  checkedAt: Date;
}

export interface StreamStats {
  infoHash?: string;
  streamName?: string;
  peers: number;
  downloadSpeed: number;
  streamProgress: number;
  streamLen: number;
  downloaded: number;
  isActive: boolean;
}

export interface StreamBehaviorHints {
  quality?: string;
  videoSize?: number;
  filename?: string;
  notWebReady?: boolean;
  bingeGroup?: string;
}

export interface StreamObject {
  name?: string;
  title?: string;
  url?: string;
  infoHash?: string;
  fileIdx?: number;
  sources?: string[];
  behaviorHints?: StreamBehaviorHints;
}

export interface StreamResourceEntry {
  name: string;
  types?: string[];
  idPrefixes?: string[];
}

export interface AddonManifestInfo {
  id: string;
  name: string;
  baseUrl: string;
  types?: string[];
  resources?: (string | StreamResourceEntry)[];
  catalogs?: ManifestCatalog[];
}

export interface ResolvedStream extends StreamObject {
  sourceAddon: string;
  quality: string;
  sizeBytes: number | null;
  seeders: number | null;
  provider: string | null;
  // Filled in at resolution time so the UI can also open the matching
  // title/series page directly in Stremio alongside external playback.
  stremioDeepLink?: string;
}

export interface PlaybackOptions {
  player: "vlc" | "mpv" | "custom" | "system";
  customPath?: string;
  extraArgs?: string;
}
