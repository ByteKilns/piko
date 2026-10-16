import type { TourId } from "./tour-steps";

// Kept in the visitor's browser (localStorage), so tours don't repeat and
// nothing needs storing on the server.
export const TOUR_STORAGE_KEY = "piko-demo-tours";

export type TourMemory = { seen: TourId[]; skippedAll: boolean };

const FRESH: TourMemory = { seen: [], skippedAll: false };

export function readTourMemory(raw: null | string): TourMemory {
  if (!raw) return FRESH;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return FRESH;
    const { seen, skippedAll } = parsed as Partial<TourMemory>;
    return { seen: Array.isArray(seen) ? seen : [], skippedAll: skippedAll === true };
  } catch {
    return FRESH;
  }
}

// A tour runs by itself once per page, unless the visitor skipped them all.
export function shouldAutoRun(memory: TourMemory, id: TourId): boolean {
  return !memory.skippedAll && !memory.seen.includes(id);
}

export function markSeen(memory: TourMemory, id: TourId): TourMemory {
  return memory.seen.includes(id) ? memory : { ...memory, seen: [...memory.seen, id] };
}

export function skipAll(memory: TourMemory): TourMemory {
  return { ...memory, skippedAll: true };
}
