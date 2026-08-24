import { beforeEach, describe, expect, it } from "vitest";
import { getAdditionalManifestUrls } from "../src/lib/addons";
import { setPreferenceValues } from "./__mocks__/@raycast/api";

describe("getAdditionalManifestUrls", () => {
  beforeEach(() => {
    setPreferenceValues({});
  });

  it("returns an empty list when nothing is configured", () => {
    expect(getAdditionalManifestUrls()).toEqual([]);
  });

  it("reads the dedicated addon slots", () => {
    setPreferenceValues({
      addonManifest1: "https://a.example/manifest.json",
      addonManifest3: "https://c.example/manifest.json",
    });
    expect(getAdditionalManifestUrls()).toEqual([
      "https://a.example/manifest.json",
      "https://c.example/manifest.json",
    ]);
  });

  it("merges slots with the legacy comma-separated field and dedupes", () => {
    setPreferenceValues({
      addonManifest1: "https://a.example/manifest.json",
      addonManifests: "https://a.example/manifest.json, https://b.example/manifest.json",
    });
    expect(getAdditionalManifestUrls()).toEqual([
      "https://a.example/manifest.json",
      "https://b.example/manifest.json",
    ]);
  });

  it("ignores blank entries and trims whitespace", () => {
    setPreferenceValues({
      addonManifest2: "  https://b.example/manifest.json  ",
      addonManifests: ",,",
    });
    expect(getAdditionalManifestUrls()).toEqual(["https://b.example/manifest.json"]);
  });
});
