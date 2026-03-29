// デフォルトグループ（タグ → グループラベル）のグローバルマッピング
// ユーザーが一度グループを割り当てると、以降のセッションで自動適用される

import { normalizeForLookup } from "./annotations";

const STORAGE_KEY = "siglane-default-groups";

export type DefaultGroups = Record<string, string>;

export function loadDefaultGroups(): DefaultGroups {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as DefaultGroups;
  } catch {
    return {};
  }
}

export function saveDefaultGroups(groups: DefaultGroups): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
}

// グループ割り当て時にデフォルトを記録
export function recordDefaultGroup(
  groups: DefaultGroups,
  promptText: string,
  groupLabel: string,
): DefaultGroups {
  const key = normalizeForLookup(promptText);
  const updated = { ...groups, [key]: groupLabel };
  saveDefaultGroups(updated);
  return updated;
}

// グループ解除時にデフォルトも削除
export function removeDefaultGroup(
  groups: DefaultGroups,
  promptText: string,
): DefaultGroups {
  const key = normalizeForLookup(promptText);
  const updated = { ...groups };
  delete updated[key];
  saveDefaultGroups(updated);
  return updated;
}

// タグのデフォルトグループを取得
export function getDefaultGroup(
  groups: DefaultGroups,
  promptText: string,
): string | undefined {
  const key = normalizeForLookup(promptText);
  return groups[key];
}
