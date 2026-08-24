import type { MetaDetail, MetaPreview } from "./types";

/** Markdown rendered in the right-hand detail pane of a list item. */
export function buildMarkdown(meta: MetaPreview | MetaDetail): string {
  const lines: string[] = [];

  if (meta.poster) {
    lines.push(`![${meta.name}](${meta.poster}?raycast-width=240&raycast-height=360)`, "");
  }
  lines.push(`## ${meta.name}`, "");
  const factLine = compactFacts(meta);
  if (factLine) {
    lines.push(factLine, "");
  }
  if (meta.description) {
    lines.push(meta.description);
  }
  return lines.join("\n");
}

/**
 * Cinematic header for the overview page: sized banner, logo/title,
 * one compact facts line, synopsis, and an optional streams footer.
 */
export function buildHeroMarkdown(meta: MetaPreview | MetaDetail, options?: { streamCount?: number }): string {
  const lines: string[] = [];

  const backdrop = meta.background ?? meta.poster;
  if (backdrop) {
    const dims =
      backdrop === meta.background ? "?raycast-width=480&raycast-height=270" : "?raycast-width=240&raycast-height=360";
    lines.push(`![](${backdrop}${dims})`, "");
  }
  lines.push(meta.logo ? `![](${meta.logo}?raycast-width=180&raycast-height=80)` : `## ${meta.name}`, "");

  const factLine = compactFacts(meta);
  if (factLine) {
    lines.push(factLine, "");
  }
  if (meta.description) {
    lines.push(meta.description, "");
  }
  if (options?.streamCount && options.streamCount > 0) {
    lines.push(`> \u25B6  **${options.streamCount} streams available** \u2014 press \u21B5 to browse`);
  }
  return lines.join("\n");
}

/** One-line summary: rating, year, runtime, genres. */
export function compactFacts(meta: MetaPreview | MetaDetail): string {
  const parts: string[] = [];
  if (meta.imdbRating) {
    parts.push(`**\u2605 ${meta.imdbRating}**`);
  }
  if (meta.releaseInfo) {
    parts.push(meta.releaseInfo);
  }
  if (meta.runtime) {
    parts.push(meta.runtime);
  }
  if (meta.genres && meta.genres.length > 0) {
    parts.push(meta.genres.slice(0, 3).join(", "));
  }
  return parts.join("  \u00B7  ");
}

export function formatReleaseDate(isoDate?: string): string | undefined {
  if (!isoDate) {
    return undefined;
  }
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
