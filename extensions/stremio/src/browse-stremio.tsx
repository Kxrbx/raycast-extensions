import { Grid, Icon, getPreferenceValues } from "@raycast/api";
import { useEffect, useState } from "react";
import { usePromise } from "@raycast/utils";
import { PAGE_SIZE, getCatalog, getCatalogFilterOptions } from "./lib/cinemeta";
import type { CatalogId, ContentType } from "./lib/types";
import { MetaActions } from "./components/actions";

const CATALOGS: { id: CatalogId; title: string }[] = [
  { id: "top", title: "Popular" },
  { id: "year", title: "New by Year" },
  { id: "imdbRating", title: "Featured" },
];

export default function Command() {
  const { defaultContentType, galleryColumns } = getPreferenceValues();
  const columns = Number.parseInt(galleryColumns, 10) || 5;
  const initialType: ContentType = defaultContentType === "series" ? "series" : "movie";

  const [contentType, setContentType] = useState<ContentType>(initialType);
  const [catalogId, setCatalogId] = useState<CatalogId>("top");
  const [genre, setGenre] = useState("");
  const [selection, setSelection] = useState(`type:${initialType}`);
  const [filterOptions, setFilterOptions] = useState<string[]>([]);

  const isYearCatalog = catalogId === "year";

  useEffect(() => {
    let cancelled = false;
    setFilterOptions([]);
    getCatalogFilterOptions(contentType, catalogId)
      .then((options) => {
        if (cancelled) {
          return;
        }
        setFilterOptions(options);
        if (isYearCatalog) {
          const nextGenre = options.includes(genre) ? genre : options[0];
          setGenre(nextGenre);
          setSelection(`genre:${nextGenre}`);
        } else if (!options.includes(genre)) {
          setGenre("");
          setSelection(`cat:${catalogId}`);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [contentType, catalogId]);

  const { isLoading, data, pagination } = usePromise(
    (type: ContentType, catalog: CatalogId, filter: string) => async (pageInfo: { page: number }) => {
      const result = await getCatalog(type, catalog, { genre: filter, skip: pageInfo.page * PAGE_SIZE });
      return { data: result.items, hasMore: result.hasNextPage };
    },
    [contentType, catalogId, genre],
  );

  function applySelection(value: string) {
    setSelection(value);
    const separatorIndex = value.indexOf(":");
    const kind = value.slice(0, separatorIndex);
    const payload = value.slice(separatorIndex + 1);
    if (kind === "type") {
      setContentType(payload === "series" ? "series" : "movie");
    } else if (kind === "cat") {
      setCatalogId(payload as CatalogId);
    } else if (kind === "genre") {
      setGenre(payload);
    }
  }

  const catalogTitle = CATALOGS.find((catalog) => catalog.id === catalogId)?.title ?? catalogId;
  const items = data ?? [];

  return (
    <Grid
      columns={columns}
      aspectRatio="2/3"
      fit={Grid.Fit.Fill}
      inset={Grid.Inset.Zero}
      isLoading={isLoading}
      pagination={pagination}
      navigationTitle={`Browse ${contentType === "series" ? "Series" : "Movies"}`}
      searchBarPlaceholder="Filter posters..."
      searchBarAccessory={
        <Grid.Dropdown tooltip="Filters" value={selection} onChange={applySelection}>
          <Grid.Dropdown.Section title="Content Type">
            <Grid.Dropdown.Item title="Movies" value="type:movie" />
            <Grid.Dropdown.Item title="Series" value="type:series" />
          </Grid.Dropdown.Section>
          <Grid.Dropdown.Section title="Category">
            {CATALOGS.map((catalog) => (
              <Grid.Dropdown.Item key={catalog.id} title={catalog.title} value={`cat:${catalog.id}`} />
            ))}
          </Grid.Dropdown.Section>
          {filterOptions.length > 0 && (
            <Grid.Dropdown.Section title={isYearCatalog ? "Year" : "Genre"}>
              {!isYearCatalog && <Grid.Dropdown.Item title="All Genres" value="genre:" />}
              {filterOptions.map((option) => (
                <Grid.Dropdown.Item key={option} title={option} value={`genre:${option}`} />
              ))}
            </Grid.Dropdown.Section>
          )}
        </Grid.Dropdown>
      }
    >
      {items.length === 0 && !isLoading ? (
        <Grid.EmptyView title="No titles found" description={`Nothing in ${catalogTitle} for this filter.`} />
      ) : (
        <Grid.Section
          title={`${catalogTitle}${isYearCatalog && genre ? ` (${genre})` : genre ? ` - ${genre}` : ""}`}
          subtitle={`${items.length}+`}
        >
          {items.map((meta, index) => (
            <Grid.Item
              key={`${meta.id}-${index}`}
              id={`${meta.id}-${index}`}
              content={meta.poster ?? Icon.QuestionMarkCircle}
              title={meta.name}
              subtitle={[meta.imdbRating ? `★ ${meta.imdbRating}` : null, meta.releaseInfo]
                .filter((part): part is string => Boolean(part))
                .join("  ·  ")}
              keywords={meta.genres}
              actions={<MetaActions meta={meta} />}
            />
          ))}
        </Grid.Section>
      )}
    </Grid>
  );
}
