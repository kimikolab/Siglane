// 辞書（プリセット）の永続化ユーティリティ

import { DictionaryEntry } from "@/types";

const STORAGE_KEY = "siglane-dictionary";

export function loadDictionary(): DictionaryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as DictionaryEntry[];
  } catch {
    return [];
  }
}

export function saveDictionary(entries: DictionaryEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function addEntry(entry: DictionaryEntry): DictionaryEntry[] {
  const entries = loadDictionary();
  entries.push(entry);
  saveDictionary(entries);
  return entries;
}

export function deleteEntry(id: string): DictionaryEntry[] {
  const entries = loadDictionary().filter((e) => e.id !== id);
  saveDictionary(entries);
  return entries;
}

export function getEntriesByCategory(category: string): DictionaryEntry[] {
  return loadDictionary().filter((e) => e.category === category);
}

export function createEntry(
  label: string,
  category: string,
  prompts: string[],
  note?: string,
): DictionaryEntry {
  return {
    id: crypto.randomUUID(),
    label,
    category,
    prompts,
    note,
    createdAt: new Date().toISOString(),
  };
}
