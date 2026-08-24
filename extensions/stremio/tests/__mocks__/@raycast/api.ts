import { vi } from "vitest";

export const Action: unknown = function Action() {
  return null as unknown;
};
export const ActionPanel: unknown = function ActionPanel() {
  return null as unknown;
};
export const Clipboard = { copy: vi.fn().mockResolvedValue(undefined) };
export const Icon = {
  Video: "video",
  Play: "play",
  Eye: "eye",
  Link: "link",
  Globe: "globe",
  House: "house",
  FilmStrip: "film",
  Tv: "tv",
};
export const Toast = { Style: { Success: 0, Failure: 1 } };
export let preferenceValues: Record<string, unknown> = {};
export function setPreferenceValues(values: Record<string, unknown>) {
  preferenceValues = values;
}
export const getPreferenceValues = (): Record<string, unknown> => preferenceValues;
export const open = vi.fn().mockResolvedValue(undefined);
export const showToast = vi.fn().mockResolvedValue(undefined);
export class Cache {
  private store = new Map<string, string>();
  get(key: string) {
    return this.store.get(key) ?? null;
  }
  set(key: string, value: string) {
    this.store.set(key, value);
    return this;
  }
  remove(key: string) {
    return this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}
