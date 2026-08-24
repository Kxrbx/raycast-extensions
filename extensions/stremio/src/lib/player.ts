import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Clipboard, Toast, getPreferenceValues, open, showToast } from "@raycast/api";
import { serverBaseUrl } from "./stremio";
import type { PlaybackOptions, ResolvedStream, StreamObject } from "./types";

const VLC_ENV_VAR = "VLC_PATH";

const localAppData = process.env.LOCALAPPDATA ?? "";

const VLC_INSTALL_PATHS = [
  "C:\\Program Files\\VideoLAN\\VLC\\vlc.exe",
  "C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe",
  join(localAppData, "VideoLAN", "VLC", "vlc.exe"),
];

type DetectedPlayer = { execPath: string; label: string };

export interface LaunchResult {
  ok: boolean;
  playerLabel?: string;
  url: string;
}

function findOnPath(binary: string): string | null {
  try {
    const output = execFileSync("where", [binary], { stdio: ["ignore", "pipe", "ignore"] }).toString();
    const first = output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);
    return first && first.toLowerCase().endsWith(`${binary}.exe`) ? first : null;
  } catch {
    return null;
  }
}

function detectVlc(): DetectedPlayer | null {
  const envOverride = process.env[VLC_ENV_VAR];
  if (envOverride && existsSync(envOverride)) {
    return { execPath: envOverride, label: "VLC" };
  }
  for (const candidate of VLC_INSTALL_PATHS) {
    if (existsSync(candidate)) {
      return { execPath: candidate, label: "VLC" };
    }
  }
  const onPath = findOnPath("vlc");
  if (onPath) {
    return { execPath: onPath, label: "VLC" };
  }
  return null;
}

function detectMpv(): DetectedPlayer | null {
  const candidate = join(process.env.LOCALAPPDATA ?? "", "mpv", "mpv.exe");
  if (existsSync(candidate)) {
    return { execPath: candidate, label: "mpv" };
  }
  const onPath = findOnPath("mpv");
  if (onPath) {
    return { execPath: onPath, label: "mpv" };
  }
  return null;
}

export function getPreferredPlayer(): PlaybackOptions {
  const { preferredPlayer, customPlayerPath, playerArguments } = getPreferenceValues<{
    preferredPlayer?: "vlc" | "mpv" | "custom" | "system";
    customPlayerPath?: string;
    playerArguments?: string;
  }>();
  return {
    extraArgs: playerArguments,
    player: preferredPlayer ?? "vlc",
    customPath: customPlayerPath,
  };
}

function resolvePlayer(options: PlaybackOptions): DetectedPlayer | null {
  if (options.player === "vlc" || (options.player === "system" && !options.customPath)) {
    return detectVlc();
  }
  if (options.player === "mpv") {
    return detectMpv();
  }
  if (options.player === "custom" && options.customPath && existsSync(options.customPath)) {
    return { execPath: options.customPath, label: "Custom player" };
  }
  if (options.player === "system") {
    return detectVlc() ?? detectMpv() ?? null;
  }
  return null;
}

/** Extracts the 40-char hex (or 32-char base32) info hash out of a magnet link. */
export function magnetInfoHash(stream: Pick<StreamObject, "infoHash" | "url">): string | null {
  const match = stream.url?.match(/^magnet:\?xt=urn:btih:([a-f0-9]{40}|[A-Z2-7]{32})/i);
  if (match) {
    return match[1];
  }
  return stream.infoHash ?? null;
}

/** Addon "sources" carry a `tracker:` prefix the streaming server does not expect. */
export function normalizeTrackers(sources?: string[]): string[] | undefined {
  const trackers = (sources ?? [])
    .map((source) => source.replace(/^tracker:/i, "").trim())
    .filter((source) => source.length > 0);
  return trackers.length > 0 ? Array.from(new Set(trackers)) : undefined;
}

/**
 * Asks the local streaming server to start a torrent session so that
 * `/{infoHash}/{fileIdx}` becomes streamable. Returns the resolved file index
 * (from the addon, or guessed by the server), or null when unknown — the
 * stream route accepts `-1` for server-side guessed selection.
 */
export async function ensureStreamSession(
  infoHash: string,
  options?: { fileIdx?: number; sources?: string[]; timeoutMs?: number },
): Promise<number | null> {
  const base = serverBaseUrl();
  const knownIndex = typeof options?.fileIdx === "number" ? options.fileIdx : undefined;
  // stremio-runtime contract: trackers are passed as "announce" and
  // guessFileIdx is a name fragment; any provided value enables file guessing.
  const payload: Record<string, unknown> = { guessFileIdx: "video" };
  const trackers = normalizeTrackers(options?.sources);
  if (trackers) {
    payload.announce = trackers;
  }
  try {
    const response = await fetch(`${base}/${encodeURIComponent(infoHash)}/create`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(options?.timeoutMs ?? 5000),
    });
    if (response.ok) {
      const stats = (await response.json()) as Partial<{
        guessedFileIdx: number;
        selectedFileIdx: number;
        fileIdx: number;
      }>;
      const guessed =
        typeof stats.guessedFileIdx === "number"
          ? stats.guessedFileIdx
          : typeof stats.selectedFileIdx === "number"
            ? stats.selectedFileIdx
            : stats.fileIdx;
      if (typeof guessed === "number" && guessed >= 0) {
        return guessed;
      }
    }
  } catch {
    // Server unavailable or session already exists — proceed with what we know.
  }
  return knownIndex ?? null;
}

export function streamHttpUrl(infoHash: string, fileIdx?: number): string {
  // `-1` asks the server for its guessed video file — safer than assuming 0.
  const index = typeof fileIdx === "number" ? fileIdx : -1;
  return `${serverBaseUrl()}/${encodeURIComponent(infoHash)}/${index}`;
}

/**
 * Spawns the player detached from Raycast so closing the video (or the player
 * misbehaving with a non-zero exit code) is irrelevant. Resolves as soon as
 * the OS accepted the spawn, rejects only on genuine spawn failures.
 */
function spawnDetached(execPath: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    try {
      const child = spawn(execPath, args, { detached: true, stdio: "ignore", windowsHide: true });
      child.once("error", (cause) => {
        if (!settled) {
          settled = true;
          reject(cause);
        }
      });
      child.once("spawn", settle);
      // Safety net: some wrappers never emit "spawn".
      setTimeout(settle, 1500);
      child.unref();
    } catch (cause) {
      reject(cause instanceof Error ? cause : new Error(String(cause)));
    }
  });
}

function splitExtraArgs(extra?: string): string[] {
  if (!extra) {
    return [];
  }
  return extra.split(/\s+/).filter(Boolean);
}

export async function playInExternalPlayer(stream: ResolvedStream): Promise<LaunchResult> {
  const options = getPreferredPlayer();

  const infoHash = magnetInfoHash(stream);
  const directUrl = !infoHash && stream.url?.startsWith("http") ? stream.url : null;
  if (!infoHash && !directUrl) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Cannot play this stream",
      message: "No torrent hash or direct URL available.",
    });
    return { ok: false, url: "" };
  }

  let url = directUrl ?? "";
  if (infoHash) {
    const fileIdx = await ensureStreamSession(infoHash, { fileIdx: stream.fileIdx, sources: stream.sources });
    url = streamHttpUrl(infoHash, fileIdx ?? undefined);
  }

  const player = resolvePlayer(options);
  if (!player) {
    await copyAndToast(url, "stream URL");
    await showToast({
      style: Toast.Style.Failure,
      title: "No player detected",
      message: "Install VLC or mpv, or set a custom player in the extension preferences.",
    });
    return { ok: false, url };
  }

  try {
    await spawnDetached(player.execPath, [...splitExtraArgs(options.extraArgs), url]);
    return { ok: true, playerLabel: player.label, url };
  } catch {
    await copyAndToast(url, "stream URL");
    await showToast({
      style: Toast.Style.Failure,
      title: "Could not start the player",
      message: `Check the ${player.label} path in the extension preferences.`,
    });
    return { ok: false, url };
  }
}

async function copyAndToast(content: string, label: string): Promise<void> {
  try {
    await Clipboard.copy(content);
    await showToast({ style: Toast.Style.Success, title: `Copied ${label}` });
  } catch {
    await open(content);
  }
}
