import { Action, ActionPanel, Color, Detail, Icon } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { getMetaDetail } from "../lib/cinemeta";
import { resolveStreams } from "../lib/addons";
import { buildHeroMarkdown, formatReleaseDate } from "../lib/markdown";
import { detailDeepLink, imdbUrl } from "../lib/stremio";
import type { MetaDetail, MetaPreview } from "../lib/types";
import {
  ConfigureExtensionAction,
  OpenImdbAction,
  OpenInStremioAction,
  ShowStreamsAction,
  usePrimaryAction,
} from "./actions";

const { Metadata } = Detail;

interface MetaOverviewPageProps {
  preview: MetaPreview;
}

const GENRE_COLORS = [Color.Blue, Color.Purple, Color.Red, Color.Orange, Color.Green, Color.Magenta, Color.Yellow];

function genreColor(genre: string): Color {
  let hash = 0;
  for (let index = 0; index < genre.length; index++) {
    hash = (hash * 31 + genre.charCodeAt(index)) % 997;
  }
  return GENRE_COLORS[hash % GENRE_COLORS.length];
}

function ratingColor(rating: string): Color {
  const value = Number.parseFloat(rating);
  if (Number.isNaN(value)) {
    return Color.SecondaryText;
  }
  if (value >= 7.5) {
    return Color.Green;
  }
  if (value >= 6) {
    return Color.Yellow;
  }
  return Color.Red;
}

/** Full-page overview rendered with the Detail component: hero art + metadata panel. */
export function MetaOverviewPage({ preview }: MetaOverviewPageProps) {
  const type = preview.type === "series" ? "series" : "movie";
  const primary = usePrimaryAction();
  const { isLoading, data } = usePromise(
    (t: string, id: string) => getMetaDetail(t as "movie" | "series", id),
    [type, preview.id],
  );
  const { data: streams } = usePromise(
    (t: string, id: string) => (t === "movie" ? resolveStreams(t, id) : Promise.resolve([])),
    [type, preview.id],
  );
  const meta: MetaPreview | MetaDetail = data ?? preview;
  const deepLink = detailDeepLink(type, preview.id);
  const trailer = trailerUrl(meta);
  const streamCount = streams?.length ?? 0;

  return (
    <Detail
      navigationTitle={preview.name}
      isLoading={isLoading}
      markdown={buildHeroMarkdown(meta, { streamCount })}
      metadata={<OverviewMetadata meta={meta} imdbId={preview.id} />}
      actions={
        <ActionPanel>
          <ShowStreamsAction meta={preview} />
          {primary === "stremio" && (
            <OpenInStremioAction deepLink={deepLink} title={`Play "${preview.name}" in Stremio`} />
          )}
          {trailer && <Action.OpenInBrowser title="Watch Trailer" icon={Icon.Play} url={trailer} />}
          <OpenImdbAction id={preview.id} />
          <Action.CopyToClipboard title="Copy Stremio Link" content={deepLink} icon={Icon.Link} />
          {primary !== "stremio" && (
            <OpenInStremioAction deepLink={deepLink} title={`Play "${preview.name}" in Stremio`} />
          )}
          <ConfigureExtensionAction />
        </ActionPanel>
      }
    />
  );
}

function OverviewMetadata({ meta, imdbId }: { meta: MetaPreview | MetaDetail; imdbId: string }) {
  const merged = meta as MetaDetail;
  const released = formatReleaseDate(merged.released);
  return (
    <Metadata>
      {merged.imdbRating && (
        <Metadata.Label
          title="IMDb Rating"
          text={{ value: `\u2605 ${merged.imdbRating}`, color: ratingColor(merged.imdbRating) }}
        />
      )}
      {imdbId.startsWith("tt") && <Metadata.Link title="IMDb Page" target={imdbUrl(imdbId)} text="Open in browser" />}
      <Metadata.Separator />
      {merged.releaseInfo && <Metadata.Label title="Year" text={merged.releaseInfo} />}
      {released && <Metadata.Label title="Released" text={released} />}
      {merged.runtime && <Metadata.Label title="Runtime" text={merged.runtime} />}
      <Metadata.Separator />
      {merged.genres && merged.genres.length > 0 && (
        <Metadata.TagList title="Genres">
          {merged.genres.slice(0, 5).map((genre) => (
            <Metadata.TagList.Item key={genre} text={genre} color={genreColor(genre)} />
          ))}
        </Metadata.TagList>
      )}
      <Metadata.Separator />
      {merged.cast && merged.cast.length > 0 && (
        <Metadata.Label title="Cast" text={merged.cast.slice(0, 3).join(", ")} />
      )}
      {merged.director && merged.director.length > 0 && (
        <Metadata.Label title="Director" text={merged.director.slice(0, 2).join(", ")} />
      )}
      <Metadata.Separator />
      {merged.country && <Metadata.Label title="Country" text={merged.country} />}
      {merged.awards && <Metadata.Label title="Awards" text={merged.awards} />}
      <Metadata.Label title="Type" text={meta.type === "series" ? "Series" : "Movie"} />
    </Metadata>
  );
}

function trailerUrl(meta: MetaPreview | MetaDetail): string | undefined {
  const id = meta.trailer ?? meta.trailers?.[0]?.source;
  return id ? `https://www.youtube.com/watch?v=${id}` : undefined;
}
