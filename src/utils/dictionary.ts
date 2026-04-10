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

// --- 拡張CRUD ---

export function renameEntry(id: string, newLabel: string): DictionaryEntry[] {
  const entries = loadDictionary();
  const entry = entries.find((e) => e.id === id);
  if (entry) entry.label = newLabel.trim();
  saveDictionary(entries);
  return entries;
}

export function updateEntryPrompts(id: string, prompts: string[]): DictionaryEntry[] {
  const entries = loadDictionary();
  const entry = entries.find((e) => e.id === id);
  if (entry) entry.prompts = prompts;
  saveDictionary(entries);
  return entries;
}

export function updateEntryCategory(id: string, newCategory: string): DictionaryEntry[] {
  const entries = loadDictionary();
  const entry = entries.find((e) => e.id === id);
  if (entry) entry.category = newCategory.trim();
  saveDictionary(entries);
  return entries;
}

export function duplicateEntry(id: string): DictionaryEntry[] {
  const entries = loadDictionary();
  const source = entries.find((e) => e.id === id);
  if (!source) return entries;

  const existingLabels = entries
    .filter((e) => e.category === source.category)
    .map((e) => e.label);

  let n = 1;
  let candidate = `${source.label} (${n})`;
  while (existingLabels.includes(candidate)) {
    n++;
    candidate = `${source.label} (${n})`;
  }

  const copy: DictionaryEntry = {
    id: crypto.randomUUID(),
    label: candidate,
    category: source.category,
    prompts: [...source.prompts],
    note: source.note,
    createdAt: new Date().toISOString(),
  };
  entries.push(copy);
  saveDictionary(entries);
  return entries;
}
