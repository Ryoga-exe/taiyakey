import type { TrialLog } from "../types";

const STORAGE_KEY = "taiyakey.trialLogs.v1";

export function loadTrialLogs(): TrialLog[] {
  const rawLogs = localStorage.getItem(STORAGE_KEY);
  if (!rawLogs) return [];

  try {
    const parsed = JSON.parse(rawLogs) as unknown;
    return Array.isArray(parsed) ? (parsed as TrialLog[]) : [];
  } catch {
    return [];
  }
}

export function appendTrialLog(log: TrialLog): TrialLog[] {
  const logs = [...loadTrialLogs(), log];
  saveTrialLogs(logs);
  return logs;
}

export function updateTrialLogSelection(id: string, selectedWord: string): TrialLog[] {
  const logs = loadTrialLogs().map((log) =>
    log.id === id ? { ...log, selectedWord } : log,
  );
  saveTrialLogs(logs);
  return logs;
}

export function clearTrialLogs(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function exportTrialLogs(logs: TrialLog[]): void {
  const blob = new Blob([`${JSON.stringify(logs, null, 2)}\n`], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `taiyakey-trials-${new Date().toISOString()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function saveTrialLogs(logs: TrialLog[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
}
