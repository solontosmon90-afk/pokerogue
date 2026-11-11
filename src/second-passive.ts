/**
 * Remembers which starter species have unlocked the "second passive" (bought with candy
 * in the starter select menu). Stored in localStorage under its own key, separate from the
 * game's save data.
 */

const STORAGE_KEY = "pr_second_passives_v1";

let cache: Set<number> | null = null;

function load(): Set<number> {
  if (cache) {
    return cache;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        cache = new Set<number>(parsed.map(Number));
        return cache;
      }
    }
  } catch {
    // Storage unavailable or corrupted: fall through to an empty set
  }
  cache = new Set<number>();
  return cache;
}

function save(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...load()]));
  } catch {
    // Ignore storage errors
  }
}

/** Whether the given starter species (the root of its evolution line) has unlocked the second passive. */
export function isSecondPassiveUnlocked(starterId: number): boolean {
  return load().has(starterId);
}

/** Unlock the second passive for the given starter species. */
export function unlockSecondPassive(starterId: number): void {
  load().add(starterId);
  save();
}
