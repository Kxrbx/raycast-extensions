import { List } from "@raycast/api";
import { Icon } from "@raycast/api";
import { buildMarkdown } from "../lib/markdown";
import { MetaActions } from "./actions";
import type { MetaPreview } from "../lib/types";

/** A catalog/search result row, shared by the Search and Browse commands. */
export function MetaListItem({ meta, id }: { meta: MetaPreview; id?: string }) {
  const isSeries = meta.type === "series";
  const accessories = [
    meta.imdbRating ? { text: `★ ${meta.imdbRating}` } : null,
    { icon: isSeries ? Icon.Desktop : Icon.FilmStrip },
  ].filter((accessory): accessory is { text: string } | { icon: Icon } => accessory !== null);

  return (
    <List.Item
      id={id ?? meta.id}
      icon={meta.poster ? { source: meta.poster } : undefined}
      title={meta.name}
      subtitle={meta.releaseInfo}
      accessories={accessories}
      detail={<List.Item.Detail markdown={buildMarkdown(meta)} />}
      actions={<MetaActions meta={meta} />}
    />
  );
}
