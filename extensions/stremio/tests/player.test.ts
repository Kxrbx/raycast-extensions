import { describe, expect, it } from "vitest";
import { magnetInfoHash, normalizeTrackers } from "../src/lib/player";
import type { StreamObject } from "../src/lib/types";

describe("normalizeTrackers", () => {
  it("strips the tracker: prefix and dedupes", () => {
    expect(
      normalizeTrackers([
        "tracker:udp://tracker.opentrackr.org:1337/announce",
        "udp://tracker.opentrackr.org:1337/announce",
        "tracker:udp://open.demonii.com:1337/announce",
      ]),
    ).toEqual(["udp://tracker.opentrackr.org:1337/announce", "udp://open.demonii.com:1337/announce"]);
  });

  it("returns undefined when there are no usable trackers", () => {
    expect(normalizeTrackers(undefined)).toBeUndefined();
    expect(normalizeTrackers([])).toBeUndefined();
    expect(normalizeTrackers(["", "tracker:"])).toBeUndefined();
  });
});

describe("magnetInfoHash", () => {
  it("extracts a hex hash from a magnet url", () => {
    const stream: StreamObject = {
      infoHash: "AAA111",
      url: "magnet:?xt=urn:btih:799DBC6AF33A8F32BF1406DC2EC68BBB6864AFFB&dn=test",
    };
    expect(magnetInfoHash(stream)).toBe("799DBC6AF33A8F32BF1406DC2EC68BBB6864AFFB");
  });

  it("falls back to the explicit infoHash field", () => {
    expect(magnetInfoHash({ infoHash: "799DBC6AF33A8F32BF1406DC2EC68BBB6864AFFB" })).toBe(
      "799DBC6AF33A8F32BF1406DC2EC68BBB6864AFFB",
    );
  });

  it("supports base32 hashes and returns null otherwise", () => {
    expect(magnetInfoHash({ url: "magnet:?xt=urn:btih:MFRGG33FMFRGG33FMFRGG33FMFRGG33F" })).toBe(
      "MFRGG33FMFRGG33FMFRGG33FMFRGG33F",
    );
    expect(magnetInfoHash({ url: "https://example.com/video.mkv" })).toBeNull();
    expect(magnetInfoHash({})).toBeNull();
  });
});
