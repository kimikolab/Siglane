// カスタマイズ可能なグループカテゴリの管理
// ユーザーが追加・削除・並び替えしたリストをlocalStorageに保存

import { DEFAULT_GROUP_CATEGORIES } from "@/types";

const STORAGE_KEY = "siglane-group-categories";

export function loadGroupCategories(): string[] {
  if (typeof window === "undefined") return [...DEFAULT_GROUP_CATEGORIES];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...DEFAULT_GROUP_CATEGORIES];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    return [...DEFAULT_GROUP_CATEGORIES];
  } catch {
    return [...DEFAULT_GROUP_CATEGORIES];
  }
}

export function saveGroupCategories(categories: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
}

export function resetGroupCategories(): string[] {
  const defaults = [...DEFAULT_GROUP_CATEGORIES];
  saveGroupCategories(defaults);
  return defaults;
}
