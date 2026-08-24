import { describe, expect, it } from "vitest";
import { enrichStream, parseProvider, parseSeeders, parseSizeBytes } from "../src/lib/addons";
import type { StreamObject } from "../src/lib/types";

describe("addon stream parsing", () => {
  it("parseSizeBytes reads human sizes", () => {
    expect(parseSizeBytes("?? 231 ?? 20.32 GB ?? ThePirateBay")).toBe(Math.round(20.32 * 1024 ** 3));
    expect(parseSizeBytes("1.5 GB")).toBe(Math.round(1.5 * 1024 ** 3));
    expect(parseSizeBytes("no size here")).toBe(null);
    expect(parseSizeBytes(undefined)).toBe(null);
  });

  it("parseSeeders extracts the seeder count", () => {
    expect(parseSeeders("?? 231 ?? 20.32 GB ?? ThePirateBay")).toBe(231);
    expect(parseSeeders("trackers.find 5 seeders")).toBe(5);
    expect(parseSeeders("none here")).toBe(null);
  });

  it("parseProvider identifies the provider", () => {
    expect(parseProvider("?? 231 ?? 20.32 GB ?? ThePirateBay")).toBe("ThePirateBay");
    expect(parseProvider("via TorrentGalaxy stream")).toBe("TorrentGalaxy");
    expect(parseProvider("nothing")).toBe(null);
  });

  it("enrichStream normalises a Torrentio-style torrent stream", () => {
    const raw: StreamObject = {
      name: "Torrentio\n4k HDR",
      title: "Dune.2021.2160p.HMAX.WEB-DL.DDP5.1.Atmos.HDR.HEVC-EVO[TGx]\n?? 231 ?? 20.32 GB ?? ThePirateBay",
      infoHash: "799DBC6AF33A8F32BF1406DC2EC68BBB6864AFFB",
      fileIdx: 0,
      behaviorHints: {
        bingeGroup: "torrentio|4k|WEB-DL|hevc|HDR",
        filename: "Dune.2021...HEVC-EVO.mkv",
      },
    };
    const enriched = enrichStream("Torrentio", raw);
    expect(enriched.sourceAddon).toBe("Torrentio");
    expect(enriched.quality).toBe("4k");
    expect(enriched.seeders).toBe(231);
    expect(enriched.provider).toBe("ThePirateBay");
    expect(enriched.sizeBytes).toBeGreaterThan(0);
  });

  it("falls back to title parsing when bingeGroup has no quality", () => {
    const raw: StreamObject = { name: "My Addon", title: "Some movie 720p" };
    const enriched = enrichStream("My Addon", raw);
    expect(enriched.quality).toBe("720p");
  });
});
