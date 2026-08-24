import { describe, expect, it } from "vitest";
import { catalogUrl } from "../src/lib/cinemeta";
import type { CatalogId, ContentType } from "../src/lib/types";

describe("catalogUrl", () => {
  it("builds a plain catalog url with no extras", () => {
    const url = catalogUrl("movie", "top", {});
    expect(url).toBe("https://v3-cinemeta.strem.io/catalog/movie/top.json");
  });

  it("encodes a single search extra", () => {
    const url = catalogUrl("movie", "top", { search: "game of thrones" });
    expect(url).toBe("https://v3-cinemeta.strem.io/catalog/movie/top/search=game%20of%20thrones.json");
  });

  it("encodes multiple extras joined with &", () => {
    const url = catalogUrl("series", "top", { search: "westeros", skip: 100 });
    expect(url).toBe("https://v3-cinemeta.strem.io/catalog/series/top/search=westeros&skip=100.json");
  });

  it("drops empty extras", () => {
    const url = catalogUrl("movie", "year", { genre: "", skip: 0 });
    expect(url).toBe("https://v3-cinemeta.strem.io/catalog/movie/year/skip=0.json");
  });

  it("compiles with typed params", () => {
    const type: ContentType = "movie";
    const catalog: CatalogId = "year";
    void catalogUrl(type, catalog, { genre: "2024" });
  });
});
