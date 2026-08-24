import { Color, Icon, Keyboard, MenuBarExtra, getPreferenceValues, open, openExtensionPreferences } from "@raycast/api";
import { useCallback, useEffect, useState } from "react";
import { checkServer, getStreamStats, openInStremio, pageDeepLink, serverBaseUrl } from "./lib/stremio";
import { formatBytes, formatSpeed } from "./lib/formatters";
import type { ServerStatus, StreamStats } from "./lib/types";

const REFRESH_INTERVAL_MS = 30000;
const REQUEST_TIMEOUT_MS = 3000;

export default function Command() {
  const { serverHost } = getPreferenceValues();
  const [status, setStatus] = useState<ServerStatus>();
  const [stream, setStream] = useState<StreamStats>();

  const refresh = useCallback(async () => {
    const serverStatus = await checkServer(REQUEST_TIMEOUT_MS);
    setStatus(serverStatus);
    const stats = serverStatus.online ? await getStreamStats(REQUEST_TIMEOUT_MS) : emptyStats();
    setStream(stats);
  }, []);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  const online = status?.online ?? false;
  const active = stream?.isActive ?? false;
  const dotColor = !status ? Color.SecondaryText : active ? Color.Yellow : online ? Color.Green : Color.Red;

  const percent = active && stream && stream.streamLen > 0 ? stream.streamProgress / stream.streamLen : 0;
  const title =
    active && stream
      ? `${formatSpeed(stream.downloadSpeed)}  ${Math.round(Math.max(0, Math.min(1, percent)) * 100)}`
      : "Stremio";

  return (
    <MenuBarExtra icon={{ source: Icon.Circle, tintColor: dotColor }} title={title} tooltip="Stremio Server Status">
      <MenuBarExtra.Section title="Connection">
        <MenuBarExtra.Item
          title={status ? (online ? "Connected" : "Offline") : "Checking..."}
          subtitle={status?.baseUrl}
        />
        <MenuBarExtra.Item title={`Host: ${serverHost ?? "127.0.0.1"}`} />
      </MenuBarExtra.Section>

      {active && stream && (
        <MenuBarExtra.Section title="Now streaming">
          <MenuBarExtra.Item title={stream.streamName || "Unknown title"} subtitle={`↕ ${stream.peers} peers`} />
          <MenuBarExtra.Item title={`${formatBytes(stream.streamProgress)} / ${formatBytes(stream.streamLen)}`} />
          <MenuBarExtra.Item title={formatSpeed(stream.downloadSpeed) || "Idle"} subtitle="Speed" />
        </MenuBarExtra.Section>
      )}

      <MenuBarExtra.Section>
        <MenuBarExtra.Item
          title="Refresh"
          icon={Icon.ArrowClockwise}
          shortcut={Keyboard.Shortcut.Common.Refresh}
          onAction={() => void refresh()}
        />
      </MenuBarExtra.Section>

      <MenuBarExtra.Section title="Stremio">
        <MenuBarExtra.Item
          title="Open Stremio Home"
          icon={Icon.House}
          onAction={() => void openInStremio(pageDeepLink("board"))}
        />
        <MenuBarExtra.Item title="Server Dashboard" icon={Icon.Globe} onAction={() => void open(serverBaseUrl())} />
        <MenuBarExtra.Item
          title="Configure Extension"
          icon={Icon.Gear}
          shortcut={{ modifiers: ["ctrl"], key: "k" }}
          onAction={() => openExtensionPreferences()}
        />
      </MenuBarExtra.Section>
    </MenuBarExtra>
  );
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
