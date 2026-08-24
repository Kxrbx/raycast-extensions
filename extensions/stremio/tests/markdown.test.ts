import { describe, expect, it } from "vitest";
import { buildHeroMarkdown, buildMarkdown, compactFacts } from "../src/lib/markdown";
import type { MetaDetail } from "../src/lib/types";

const base = {
  id: "tt1254207",
  type: "movie",
  name: "Dune",
  imdbRating: "8.1",
  releaseInfo: "2021",
  runtime: "2h 35m",
  genres: ["Sci-Fi", "Adventure"],
  description: "A noble family becomes embroiled in a war for control over the galaxy's most valuable asset.",
};

describe("buildHeroMarkdown", () => {
  it("uses a sized 16:9 banner when a background exists", () => {
    const md = buildHeroMarkdown({ ...base, background: "https://img/back.jpg" } as MetaDetail);
    expect(md).toContain("https://img/back.jpg?raycast-width=480&raycast-height=270");
  });

  it("falls back to a 2:3 poster banner", () => {
    const md = buildHeroMarkdown({ ...base, poster: "https://img/poster.jpg" } as MetaDetail);
    expect(md).toContain("https://img/poster.jpg?raycast-width=240&raycast-height=360");
  });

  it("renders the logo when present, the title otherwise", () => {
    const withLogo = buildHeroMarkdown({ ...base, logo: "https://img/logo.png" } as MetaDetail);
    expect(withLogo).toContain("https://img/logo.png");
    expect(withLogo).not.toContain("## Dune");
    const withoutLogo = buildHeroMarkdown(base as MetaDetail);
    expect(withoutLogo).toContain("## Dune");
  });

  it("appends a streams footer when a count is provided", () => {
    const md = buildHeroMarkdown(base as MetaDetail, { streamCount: 148 });
    expect(md).toContain("148 streams available");
    const empty = buildHeroMarkdown(base as MetaDetail, { streamCount: 0 });
    expect(empty).not.toContain("streams available");
  });
});

describe("compactFacts", () => {
  it("joins rating, year, runtime and genres on one line", () => {
    const line = compactFacts(base as MetaDetail);
    expect(line).toContain("\u2605 8.1");
    expect(line).toContain("2021");
    expect(line).toContain("2h 35m");
    expect(line).toContain("Sci-Fi, Adventure");
  });
});

describe("buildMarkdown", () => {
  it("constrains the poster to a 2:3 thumbnail", () => {
    const md = buildMarkdown({ ...base, poster: "https://img/poster.jpg" } as MetaDetail);
    expect(md).toContain("https://img/poster.jpg?raycast-width=240&raycast-height=360");
  });
});
