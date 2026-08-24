import {
  Action,
  ActionPanel,
  Icon,
  getPreferenceValues,
  openExtensionPreferences,
  popToRoot,
  showHUD,
} from "@raycast/api";
import { detailDeepLink, imdbUrl, openInStremio, searchDeepLink } from "../lib/stremio";
import { magnetInfoHash, playInExternalPlayer, streamHttpUrl } from "../lib/player";
import type { MetaPreview, ResolvedStream, Video } from "../lib/types";
import { MetaDetailView } from "./meta-detail";
import { MetaOverviewPage } from "./meta-overview";

type PrimaryAction = "external-player" | "stremio";

export function usePrimaryAction(): PrimaryAction {
  const preference = getPreferenceValues<{ primaryAction?: PrimaryAction }>().primaryAction;
  return preference ?? "external-player";
}

/** Available on every panel of the extension via Ctrl+K. */
export function ConfigureExtensionAction() {
  return (
    <Action
      title="Configure Extension"
      icon={Icon.Gear}
      shortcut={{ modifiers: ["ctrl"], key: "k" }}
      onAction={() => openExtensionPreferences()}
    />
  );
}

export function OpenInStremioAction({ deepLink, title = "Open in Stremio" }: { deepLink: string; title?: string }) {
  return <Action title={title} icon={Icon.Play} onAction={() => openInStremio(deepLink)} />;
}

export function PlayInPlayerAction({
  stream,
  title = "Play in external player",
}: {
  stream: ResolvedStream;
  title?: string;
}) {
  const label = firstLine(stream.name) ?? firstLine(stream.title) ?? "stream";
  return (
    <Action
      title={title}
      icon={Icon.Video}
      shortcut={{ modifiers: ["cmd", "shift"], key: "p" }}
      onAction={async () => {
        const result = await playInExternalPlayer(stream);
        if (result.ok) {
          await showHUD(`\u25B6  ${label} \u2014 ${result.playerLabel ?? "player"}`);
          popToRoot();
        }
      }}
    />
  );
}

export function CopyStreamUrlAction({ stream }: { stream: ResolvedStream }) {
  const infoHash = magnetInfoHash(stream);
  if (!infoHash && !stream.url?.startsWith("http")) {
    return null;
  }
  const url = infoHash ? streamHttpUrl(infoHash, stream.fileIdx) : (stream.url as string);
  return <Action.CopyToClipboard title="Copy Stream URL" content={url} icon={Icon.Link} />;
}

export function MetaActions({ meta, searchQuery }: { meta: MetaPreview; searchQuery?: string }) {
  const type = meta.type === "series" ? "series" : "movie";
  const deepLink = detailDeepLink(type, meta.id);
  const primary = usePrimaryAction();

  return (
    <ActionPanel>
      <ShowDetailsAction meta={meta} />
      {primary === "stremio" && <OpenInStremioAction deepLink={deepLink} title={`Play "${meta.name}" in Stremio`} />}
      <Action.CopyToClipboard title="Copy Stremio Link" content={deepLink} icon={Icon.Link} />
      <OpenImdbAction id={meta.id} />
      {searchQuery && (
        <OpenInStremioAction deepLink={searchDeepLink(searchQuery)} title={`Search "${searchQuery}" in Stremio`} />
      )}
      <ConfigureExtensionAction />
    </ActionPanel>
  );
}

export function EpisodeActions({ seriesId, video }: { seriesId: string; video: Video }) {
  const videoId = video.id;
  const deepLink = detailDeepLink("series", seriesId, videoId);
  const label = video.name ?? video.title ?? `Episode ${video.episode ?? ""}`.trim();
  const primary = usePrimaryAction();

  return (
    <ActionPanel>
      <ShowEpisodeDetailsAction seriesId={seriesId} videoId={videoId} name={label} />
      {primary === "stremio" && <OpenInStremioAction deepLink={deepLink} title={`Play "${label}" in Stremio`} />}
      <Action.CopyToClipboard title="Copy Episode Link" content={deepLink} icon={Icon.Link} />
      <ConfigureExtensionAction />
    </ActionPanel>
  );
}

export function ShowDetailsAction({ meta }: { meta: MetaPreview }) {
  return <Action.Push title="Show Details" icon={Icon.Eye} target={<MetaOverviewPage preview={meta} />} />;
}

export function ShowStreamsAction({ meta }: { meta: MetaPreview }) {
  return <Action.Push title="Show Streams" icon={Icon.Video} target={<MetaDetailView preview={meta} />} />;
}

export function ShowEpisodeDetailsAction({
  seriesId,
  videoId,
  name,
}: {
  seriesId: string;
  videoId: string;
  name: string;
}) {
  const preview = { id: seriesId, name, type: "series" } as MetaPreview;
  return (
    <Action.Push
      title="Show Episode Streams"
      icon={Icon.Video}
      target={<MetaDetailView preview={preview} episodeId={videoId} />}
    />
  );
}

export function StreamActions({ stream }: { stream: ResolvedStream }) {
  return (
    <ActionPanel>
      <PlayInPlayerAction stream={stream} />
      <Action
        title="Open in Stremio"
        icon={Icon.Play}
        onAction={() => openInStremio(stream.stremioDeepLink ?? magnetToDeepLinkFallback(stream))}
      />
      <CopyStreamUrlAction stream={stream} />
      {stream.url && stream.url.startsWith("magnet:") && (
        <Action.CopyToClipboard title="Copy Magnet" content={stream.url} icon={Icon.Link} />
      )}
      {magnetInfoHash(stream) && (
        <Action.CopyToClipboard title="Copy Info Hash" content={magnetInfoHash(stream) ?? ""} icon={Icon.Link} />
      )}
      <ConfigureExtensionAction />
    </ActionPanel>
  );
}

export function OpenImdbAction({ id }: { id: string }) {
  if (!id.startsWith("tt")) {
    return null;
  }
  return <Action.OpenInBrowser title="Open on IMDb" icon={Icon.Globe} url={imdbUrl(id)} />;
}

function magnetToDeepLinkFallback(stream: ResolvedStream): string {
  const infoHash = magnetInfoHash(stream);
  return infoHash ? `magnet:?xt=urn:btih:${infoHash}` : "#";
}

function firstLine(text?: string): string | undefined {
  const line = text?.split("\n")[0]?.trim();
  return line ? line : undefined;
}
