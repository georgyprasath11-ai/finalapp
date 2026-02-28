import { CheckboxSound } from "@/types/models";

const bundledSoundModules = import.meta.glob("/src/assets/sounds/*.mp3", {
  eager: true,
  import: "default",
}) as Record<string, string>;

const toDisplayName = (filename: string): string => {
  const withoutExt = filename.replace(/\.mp3$/i, "");
  return withoutExt
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const uniqueName = (raw: string, seen: Map<string, number>): string => {
  const current = seen.get(raw) ?? 0;
  if (current === 0) {
    seen.set(raw, 1);
    return raw;
  }

  const next = current + 1;
  seen.set(raw, next);
  return `${raw} (${next})`;
};

export const loadBundledCheckboxSounds = (): CheckboxSound[] => {
  const seen = new Map<string, number>();

  return Object.entries(bundledSoundModules)
    .map(([path, url]) => {
      const segments = path.split("/");
      const rawFilename = segments[segments.length - 1] ?? "sound.mp3";
      const display = uniqueName(toDisplayName(rawFilename), seen);

      return {
        id: `bundled:${rawFilename.toLowerCase()}`,
        name: display,
        source: "bundled" as const,
        url,
        createdAt: new Date(0).toISOString(),
      } satisfies CheckboxSound;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
};

export const filenameWithoutExtension = (filename: string): string =>
  filename.replace(/\.[^.]+$/, "");
