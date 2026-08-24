import { Action, ActionPanel, Icon, List } from "@raycast/api";
import { useEffect, useMemo, useState } from "react";
import { getMetaDetail } from "../lib/cinemeta";
import { buildHeroMarkdown, formatReleaseDate } from "../lib/markdown";
import { detailDeepLink, imdbUrl } from "../lib/stremio";
import { formatBytes } from "../lib/formatters";
import { resolveStreams } from "../lib/addons";
import type { ContentType, MetaDetail, MetaPreview, ResolvedStream, Video } from "../lib/types";
import {
  ConfigureExtensionAction,
  EpisodeActions,
  OpenImdbAction,
  OpenInStremioAction,
  StreamActions,
  usePrimaryAction,
} from "./actions";
import { MetaOverviewPage } from "./meta-overview";

interface MetaDetailViewProps {
  preview: MetaPreview;
  episodeId?: string;
}

const { Metadata } = List.Item.Detail;

export function MetaDetailView({ preview, episodeId }: MetaDetailViewProps) {
  const type: ContentType = preview.type === "series" ? "series" : "movie";
  const primary = usePrimaryAction();

  const [detail, setDetail] = useState<MetaDetail>();
  const [streams, setStreams] = useState<ResolvedStream[]>();
  const [error, setError] = useState<string>();
  const [selectedSeason, setSelectedSeason] = useState<number>();

  useEffect(() => {
    let cancelled = false;
    getMetaDetail(type, preview.id)
      .then((loaded) => {
        if (!cancelled) {
          setDetail(loaded);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [type, preview.id]);

  useEffect(() => {
    let cancelled = false;
    setError(undefined);
    resolveStreams(type, preview.id, episodeId)
      .then((loaded) => {
        if (!cancelled) {
          const deepLink = episodeId
            ? detailDeepLink("series", preview.id, episodeId)
            : detailDeepLink(type, preview.id);
          setStreams(loaded.map((stream) => ({ ...stream, stremioDeepLink: deepLink })));
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [type, preview.id, episodeId]);

  const seasons = useMemo(() => groupBySeason(detail), [detail]);

  const activeSeason =
    selectedSeason ?? (seasons.some((season) => season.seasonNumber === 1) ? 1 : (seasons[0]?.seasonNumber ?? 1));
  const currentEpisodes = seasons.find((season) => season.seasonNumber === activeSeason)?.episodes ?? [];
  const isLoading = !detail && !streams;
  const deepLink = episodeId ? detailDeepLink("series", preview.id, episodeId) : detailDeepLink(type, preview.id);

  return (
    <List
      navigationTitle={preview.name}
      isLoading={isLoading}
      isShowingDetail
      selectedItemId={episodeId ? undefined : "title-item"}
      searchBarAccessory={
        seasons.length > 1 ? (
          <List.Dropdown
            tooltip="Select Season"
            value={String(activeSeason)}
            onChange={(value) => setSelectedSeason(Number(value))}
          >
            {seasons.map(({ seasonNumber }) => (
              <List.Dropdown.Item key={seasonNumber} value={String(seasonNumber)} title={`Season ${seasonNumber}`} />
            ))}
          </List.Dropdown>
        ) : undefined
      }
    >
      {error ? (
        <List.EmptyView title="Could not load details" description={error} />
      ) : (
        <>
          <List.Section title={type === "series" ? "Show" : "Movie"}>
            <List.Item
              id="title-item"
              icon={preview.poster ? { source: preview.poster } : undefined}
              title={preview.name}
              subtitle={
                episodeId
                  ? (currentEpisodes.find((episode) => episode.id === episodeId)?.name ?? "")
                  : [preview.releaseInfo, detail?.runtime].filter(Boolean).join("  \u2022  ")
              }
              accessories={[
                preview.imdbRating ? { text: `\u2605 ${preview.imdbRating}` } : null,
                preview.genres && preview.genres.length > 0 ? { tag: { value: preview.genres[0] } } : null,
              ].filter((accessory): accessory is { text: string } | { tag: { value: string } } => accessory !== null)}
              detail={
                <List.Item.Detail
                  markdown={buildHeroMarkdown(detail ?? preview)}
                  metadata={<MetaMetadata preview={preview} detail={detail} imdbId={preview.id} />}
                />
              }
              actions={
                <ActionPanel>
                  <Action.Push title="Show Overview" icon={Icon.Eye} target={<MetaOverviewPage preview={preview} />} />
                  {primary === "stremio" && (
                    <OpenInStremioAction deepLink={deepLink} title={`Play "${preview.name}" in Stremio`} />
                  )}
                  <OpenImdbAction id={preview.id} />
                  <Action.CopyToClipboard title="Copy Stremio Link" content={deepLink} icon={Icon.Link} />
                  {primary !== "stremio" && (
                    <OpenInStremioAction deepLink={deepLink} title={`Play "${preview.name}" in Stremio`} />
                  )}
                  <ConfigureExtensionAction />
                </ActionPanel>
              }
            />
          </List.Section>

          {currentEpisodes.length > 0 && (
            <List.Section title={`Season ${activeSeason}`}>
              {currentEpisodes.map((video) => (
                <List.Item
                  key={video.id}
                  id={video.id}
                  icon={video.thumbnail ? { source: video.thumbnail } : undefined}
                  title={video.name ?? video.title ?? `Episode ${video.episode ?? ""}`.trim()}
                  accessories={[video.episode !== undefined ? { text: `E${video.episode}` } : null].filter(
                    (accessory): accessory is { text: string } => accessory !== null,
                  )}
                  actions={<EpisodeActions seriesId={preview.id} video={video} />}
                  detail={<List.Item.Detail markdown={buildEpisodeMarkdown(video)} />}
                />
              ))}
            </List.Section>
          )}

          {streams && streams.length > 0 && (
            <List.Section title={episodeId ? "Episode streams" : "Streams"} subtitle={`${streams.length}`}>
              {streams.map((stream, index) => (
                <StreamItem key={`${stream.sourceAddon}-${index}`} stream={stream} />
              ))}
            </List.Section>
          )}

          {streams?.length === 0 && !error && (
            <List.EmptyView
              title="No streams available"
              description="Install a stream addon in Stremio (e.g. Torrentio)."
            />
          )}
        </>
      )}
    </List>
  );
}

function StreamItem({ stream }: { stream: ResolvedStream }) {
  const qualityLabel = stream.quality ? stream.quality.toUpperCase() : "";
  const streamTitle = firstLine(stream.title) ?? firstLine(stream.name) ?? "Stream";
  return (
    <List.Item
      id={`${stream.sourceAddon}-${stream.infoHash ?? stream.url}-${stream.fileIdx ?? 0}`}
      icon={{ source: Icon.Play }}
      title={qualityLabel || streamTitle}
      subtitle={qualityLabel ? streamTitle : (stream.sourceAddon ?? "")}
      accessories={[
        stream.seeders !== null && stream.seeders > 0 ? { text: `${stream.seeders} seeders` } : null,
        stream.sizeBytes ? { text: formatBytes(stream.sizeBytes) } : null,
      ].filter((accessory): accessory is { text: string } => accessory !== null)}
      detail={<List.Item.Detail markdown={buildStreamMarkdown(stream)} />}
      actions={<StreamActions stream={stream} />}
    />
  );
}

function MetaMetadata({ preview, detail, imdbId }: { preview: MetaPreview; detail?: MetaDetail; imdbId: string }) {
  const merged: MetaDetail = { ...preview, ...(detail ?? {}) };
  return (
    <Metadata>
      {merged.imdbRating && (
        <Metadata.Link title="IMDb Rating" target={imdbUrl(imdbId)} text={`\u2605 ${merged.imdbRating}`} />
      )}
      {merged.releaseInfo && <Metadata.Label title="Released" text={merged.releaseInfo} />}
      {merged.runtime && <Metadata.Label title="Runtime" text={merged.runtime} />}
      {merged.genres && merged.genres.length > 0 && (
        <Metadata.TagList title="Genres">
          {merged.genres.slice(0, 4).map((genre) => (
            <Metadata.TagList.Item key={genre} text={genre} />
          ))}
        </Metadata.TagList>
      )}
      {merged.cast && merged.cast.length > 0 && (
        <Metadata.Label title="Cast" text={merged.cast.slice(0, 3).join(", ")} />
      )}
      {merged.director && merged.director.length > 0 && (
        <Metadata.Label title="Director" text={merged.director.slice(0, 2).join(", ")} />
      )}
      <Metadata.Label title="Type" text={merged.type === "series" ? "Series" : "Movie"} />
    </Metadata>
  );
}

function groupBySeason(detail?: MetaDetail): { seasonNumber: number; episodes: Video[] }[] {
  const bySeason = new Map<number, Video[]>();
  for (const video of detail?.videos ?? []) {
    const seasonNumber = typeof video.season === "number" ? video.season : 0;
    const existing = bySeason.get(seasonNumber) ?? [];
    existing.push(video);
    bySeason.set(seasonNumber, existing);
  }
  return [...bySeason.entries()]
    .map(([seasonNumber, episodes]) => ({
      seasonNumber,
      episodes: episodes.sort((a, b) => (a.episode ?? 0) - (b.episode ?? 0)),
    }))
    .sort((a, b) => a.seasonNumber - b.seasonNumber);
}

function buildEpisodeMarkdown(video: Video): string {
  const lines: string[] = [];
  if (video.thumbnail) {
    lines.push(`![](${video.thumbnail})`, "");
  }
  const title = video.name ?? video.title ?? `Episode ${video.episode ?? ""}`.trim();
  lines.push(`## ${title}`, "");
  const overview = video.overview ?? video.description;
  if (overview) {
    lines.push(overview);
  }
  if (video.released) {
    lines.push("", `**Released:** ${formatReleaseDate(video.released)}`);
  }
  return lines.join("\n");
}

function buildStreamMarkdown(stream: ResolvedStream): string {
  const lines: string[] = [];
  lines.push(`## ${firstLine(stream.title) ?? firstLine(stream.name) ?? "Stream"}`);
  lines.push(`- Source: ${stream.sourceAddon}`);
  if (stream.quality) {
    lines.push(`- Quality: ${stream.quality.toUpperCase()}`);
  }
  if (stream.sizeBytes) {
    lines.push(`- Size: ${formatBytes(stream.sizeBytes)}`);
  }
  if (stream.seeders !== null) {
    lines.push(`- Seeders: ${stream.seeders}`);
  }
  if (stream.provider) {
    lines.push(`- Provider: ${stream.provider}`);
  }
  if (stream.behaviorHints?.filename) {
    lines.push("");
    lines.push(stream.behaviorHints.filename);
  }
  return lines.join("\n");
}

function firstLine(text?: string): string | undefined {
  const line = text?.split("\n")[0]?.trim();
  return line ? line : undefined;
}
