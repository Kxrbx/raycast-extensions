import { describe, expect, it } from "vitest";
import { formatBytes, formatSpeed, formatProgress, clamp } from "../src/lib/formatters";

describe("formatters", () => {
  it("formats bytes to human readable", () => {
    expect(formatBytes(0)).toBe("");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1700)).toBe("1.66 KB");
    expect(formatBytes(1048576)).toBe("1.00 MB");
    expect(formatBytes(1073741824)).toBe("1.00 GB");
  });

  it("formats speed with /s", () => {
    expect(formatSpeed(0)).toBe("");
    expect(formatSpeed(1048576)).toBe("1.00 MB/s");
    expect(formatSpeed(1500000)).toBe("1.43 MB/s");
  });

  it("formats progress ratio", () => {
    expect(formatProgress(0.5)).toBe("50");
    expect(formatProgress(1)).toBe("100%");
    expect(formatProgress(1.2)).toBe("100%");
    expect(formatProgress(-1)).toBe("");
    expect(formatProgress(0).length).toBeGreaterThan(0);
  });

  it("clamps values", () => {
    expect(clamp(150, 0, 100)).toBe(100);
    expect(clamp(-5, 0, 100)).toBe(0);
    expect(clamp(42, 0, 100)).toBe(42);
  });
});
