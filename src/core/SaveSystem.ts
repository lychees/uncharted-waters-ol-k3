import type { GameState } from './State';

const KEY = 'dol-save-v1';

export function saveGame(state: GameState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // 存储满/隐私模式等场景下静默失败
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameState;
    if (typeof parsed.day !== 'number' || !Array.isArray(parsed.fleet)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function hasSave(): boolean {
  return localStorage.getItem(KEY) !== null;
}

export function clearSave(): void {
  localStorage.removeItem(KEY);
}
