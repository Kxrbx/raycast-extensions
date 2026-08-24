import { Action, ActionPanel, Icon, LaunchProps, List, open, showToast, Toast } from "@raycast/api";
import { useEffect, useRef } from "react";
import { pageDeepLink, searchDeepLink, serverBaseUrl } from "./lib/stremio";
import { OpenInStremioAction, ConfigureExtensionAction } from "./components/actions";

const DESTINATIONS = [
  { title: "Home", subtitle: "Board", deepLink: pageDeepLink("board"), icon: Icon.House },
  { title: "Library", deepLink: pageDeepLink("library"), icon: Icon.Bookmark },
  { title: "Discover", deepLink: pageDeepLink("discover"), icon: Icon.Compass },
  { title: "Calendar", deepLink: pageDeepLink("calendar"), icon: Icon.Calendar },
  { title: "Addons", deepLink: pageDeepLink("addons"), icon: Icon.Layers },
  { title: "Settings", deepLink: pageDeepLink("settings"), icon: Icon.Gear },
  { title: "Search in Stremio", deepLink: searchDeepLink(""), icon: Icon.MagnifyingGlass },
];

export default function Command(props: LaunchProps<{ arguments: Arguments.QuickNavigation }>) {
  const query = props.arguments.query?.trim() ?? "";
  const didOpenQuery = useRef(false);

  useEffect(() => {
    if (!query || didOpenQuery.current) {
      return;
    }
    didOpenQuery.current = true;
    void open(searchDeepLink(query)).catch(() =>
      showToast({
        style: Toast.Style.Failure,
        title: "Could not open Stremio",
        message: "Make sure the Stremio desktop app is installed on this computer.",
      }),
    );
    void showToast({ style: Toast.Style.Success, title: `Searching "${query}" in Stremio` });
  }, [query]);

  return (
    <List navigationTitle="Stremio Quick Navigation" searchBarPlaceholder="Navigate in Stremio">
      {query && (
        <List.Item
          icon={Icon.MagnifyingGlass}
          title={`Search "${query}" in Stremio`}
          actions={
            <ActionPanel>
              <OpenInStremioAction deepLink={searchDeepLink(query)} title={`Search "${query}"`} />
              <Action.OpenInBrowser title="Search in Stremio Web" url={searchWebUrl(query)} />
              <ConfigureExtensionAction />
            </ActionPanel>
          }
        />
      )}
      <List.Section title="Jump to">
        {DESTINATIONS.map((destination) => (
          <List.Item
            key={destination.title}
            icon={destination.icon}
            title={destination.title}
            subtitle={destination.subtitle}
            actions={
              <ActionPanel>
                <OpenInStremioAction deepLink={destination.deepLink} title={`Open ${destination.title}`} />
                <Action.CopyToClipboard title="Copy Link" content={destination.deepLink} icon={Icon.Link} />
                <ConfigureExtensionAction />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
      <List.Section title="Streaming Server">
        <List.Item
          icon={Icon.Globe}
          title="Server Dashboard"
          subtitle={serverBaseUrl()}
          actions={
            <ActionPanel>
              <Action.OpenInBrowser title="Open Dashboard" url={`${serverBaseUrl()}/`} icon={Icon.Globe} />
              <Action.CopyToClipboard title="Copy Server URL" content={serverBaseUrl()} icon={Icon.Link} />
              <ConfigureExtensionAction />
            </ActionPanel>
          }
        />
      </List.Section>
    </List>
  );
}

function searchWebUrl(query: string): string {
  return `https://web.stremio.com/#/search?search=${encodeURIComponent(query)}`;
}
