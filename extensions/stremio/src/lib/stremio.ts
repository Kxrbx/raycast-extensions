import { getPreferenceValues, open, showToast, Toast } from "@raycast/api";
import type { ServerStatus, StreamStats } from "./types";

export type StremioPage = "board" | "library" | "discover" | "calendar" | "addons" | "settings";

export function serverBaseUrl(): string {
  const { serverHost, serverPort } = getPreferenceValues<{ serverHost?: string; serverPort?: string }>();
  const host = (serverHost ?? "").trim() || "127.0.0.1";
  const port = Number.parseInt(serverPort ?? "", 10);
  return `http://${host}:${Number.isNaN(port) ? 11470 : port}`;
}

export async function checkServer(timeoutMs = 2500): Promise<ServerStatus> {
  const baseUrl = serverBaseUrl();
  try {
    const response = await fetch(`${baseUrl}/heartbeat`, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Accept: "application/json" },
    });
    return { online: response.ok, baseUrl, checkedAt: new Date() };
  } catch {
    return { online: false, baseUrl, checkedAt: new Date() };
  }
}

/** Live torrent/stream stats from the local Stremio engine. */
export async function getStreamStats(timeoutMs = 2500): Promise<StreamStats> {
  const baseUrl = serverBaseUrl();
  try {
    const response = await fetch(`${baseUrl}/stats.json`, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return emptyStats();
    }
    const json = (await response.json()) as Partial<{
      streamName: string;
      peers: number;
      downloadSpeed: number;
      streamProgress: number;
      streamLen: number;
      downloaded: number;
    }>;
    const streamLen = json.streamLen ?? 0;
    return {
      isActive: streamLen > 0,
      downloadSpeed: json.downloadSpeed ?? 0,
      downloaded: json.downloaded ?? 0,
      peers: json.peers ?? 0,
      streamLen,
      streamName: json.streamName ?? "",
      streamProgress: json.streamProgress ?? 0,
    };
  } catch {
    return emptyStats();
  }
}

function emptyStats(): StreamStats {
  return {
    isActive: false,
    downloadSpeed: 0,
    downloaded: 0,
    peers: 0,
    streamLen: 0,
    streamName: "",
    streamProgress: 0,
  };
}

export function detailDeepLink(type: string, id: string, videoId?: string): string {
  const base = `stremio:///detail/${type}/${encodeURIComponent(id)}`;
  return videoId ? `${base}/${encodeURIComponent(videoId)}` : base;
}

export function pageDeepLink(page: StremioPage): string {
  return `stremio:///${page}`;
}

export function searchDeepLink(query: string): string {
  return `stremio:///search?search=${encodeURIComponent(query.trim())}`;
}

export function imdbUrl(id: string): string {
  return `https://www.imdb.com/title/${id}/`;
}

/**
 * Opens a stremio:// deep link in the desktop app installed on this computer.
 * Shows a helpful toast instead of throwing when Stremio is missing.
 */
export async function openInStremio(deepLink: string): Promise<void> {
  try {
    await open(deepLink);
  } catch {
    await showToast({
      style: Toast.Style.Failure,
      title: "Could not open Stremio",
      message: "Make sure the Stremio desktop app is installed on this computer.",
    });
  }
}
