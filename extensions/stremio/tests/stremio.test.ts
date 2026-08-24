import { describe, expect, it } from "vitest";
import { detailDeepLink, imdbUrl, pageDeepLink, searchDeepLink } from "../src/lib/stremio";

describe("deep links", () => {
  it("builds a movie detail link", () => {
    expect(detailDeepLink("movie", "tt1254207")).toBe("stremio:///detail/movie/tt1254207");
  });

  it("builds a series season/episode link when videoId is provided", () => {
    expect(detailDeepLink("series", "tt0903747", "tt0903747:1:1")).toBe(
      "stremio:///detail/series/tt0903747/tt0903747%3A1%3A1",
    );
  });

  it("encodes special characters in ids", () => {
    expect(detailDeepLink("movie", "nghb:12345")).toBe("stremio:///detail/movie/nghb%3A12345");
  });

  it("builds a search link with encoded query", () => {
    expect(searchDeepLink("hello world")).toBe("stremio:///search?search=hello%20world");
    expect(searchDeepLink("  loose  ")).toBe("stremio:///search?search=loose");
  });

  it("builds page links", () => {
    expect(pageDeepLink("board")).toBe("stremio:///board");
    expect(pageDeepLink("library")).toBe("stremio:///library");
  });

  it("builds IMDb URLs", () => {
    expect(imdbUrl("tt1254207")).toBe("https://www.imdb.com/title/tt1254207/");
  });
});
