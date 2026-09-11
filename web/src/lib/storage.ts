import type { StockInfo } from "../types";

const WATCHLIST_KEY = "smf.watchlist.v1";
const THRESHOLD_KEY = "smf.threshold.v1";

export const MAX_WATCHLIST = 50;
export const DEFAULT_THRESHOLD = 4;
export const THRESHOLD_OPTIONS = [3, 4, 5, 7];

export function loadWatchlist(): StockInfo[] {
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is StockInfo => s && typeof s.code === "string" && typeof s.name === "string"
    );
  } catch {
    return [];
  }
}

export function saveWatchlist(list: StockInfo[]): void {
  try {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list.slice(0, MAX_WATCHLIST)));
  } catch {
    // localStorage unavailable (private mode / quota) — silently ignore, in-memory state still works.
  }
}

export function loadThreshold(): number {
  try {
    const raw = localStorage.getItem(THRESHOLD_KEY);
    const n = raw ? Number(raw) : DEFAULT_THRESHOLD;
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_THRESHOLD;
  } catch {
    return DEFAULT_THRESHOLD;
  }
}

export function saveThreshold(threshold: number): void {
  try {
    localStorage.setItem(THRESHOLD_KEY, String(threshold));
  } catch {
    // ignore
  }
}
