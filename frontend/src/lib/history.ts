import type { HistoryEntry } from "../types";

const HISTORY_KEY = "charvision-history";

export function readHistory(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as HistoryEntry[];
  } catch {
    return [];
  }
}

export function saveRecognition(entry: HistoryEntry): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify([entry, ...readHistory()].slice(0, 20)));
}

export function clearHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
}
