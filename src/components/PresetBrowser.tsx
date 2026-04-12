"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import type { DictionaryEntry } from "@/types";
import { loadDictionary } from "@/utils/dictionary";

interface PresetBrowserProps {
  /** Add all prompts from a preset to the session */
  onAddPreset: (type: "positive" | "negative", prompts: string[], groupLabel: string) => void;
  /** Open full preset management view */
  onOpenManage: () => void;
}

export default function PresetBrowser({
  onAddPreset,
  onOpenManage,
}: PresetBrowserProps) {
  const [allEntries, setAllEntries] = useState<DictionaryEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Load presets from localStorage
  useEffect(() => {
    setAllEntries(loadDictionary());
  }, []);

  // Re-load when tab becomes visible (storage may have changed)
  useEffect(() => {
    const onFocus = () => setAllEntries(loadDictionary());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  // Available categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const e of allEntries) {
      if (e.category) {
        // Top-level category (before /)
        const top = e.category.split("/")[0];
        cats.add(top);
      }
    }
    return Array.from(cats).sort();
  }, [allEntries]);

  // Filter
  const filtered = useMemo(() => {
    let result = allEntries;
    if (categoryFilter !== "all") {
      result = result.filter(
        (e) => e.category === categoryFilter || e.category.startsWith(categoryFilter + "/"),
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.label.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q) ||
          e.prompts.some((p) => p.toLowerCase().includes(q)),
      );
    }
    return result.sort((a, b) => a.label.localeCompare(b.label));
  }, [allEntries, categoryFilter, searchQuery]);

  const handleAdd = useCallback(
    (entry: DictionaryEntry, shiftKey: boolean) => {
      const type = shiftKey ? "negative" : "positive";
      onAddPreset(type, entry.prompts, entry.category);
    },
    [onAddPreset],
  );

  return (
    <div className="flex flex-col gap-2 h-full">
      {/* Search + filter */}
      <div className="flex flex-col gap-1.5 flex-shrink-0">
        <input
          type="text"
          placeholder="Search presets..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-neutral-800 border border-neutral-700 rounded px-2.5 py-1.5 text-xs text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500"
        />
        <div className="flex items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="flex-1 min-w-0 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-[11px] text-neutral-300 focus:outline-none focus:border-neutral-500"
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <span className="text-[10px] text-neutral-600 whitespace-nowrap">
            {filtered.length}/{allEntries.length}
          </span>
        </div>
      </div>

      {/* Preset list */}
      <div className="flex-1 overflow-y-auto sidebar-scroll min-h-0">
        {filtered.length === 0 ? (
          <p className="text-xs text-neutral-600 text-center py-6">
            {searchQuery ? "No matching presets" : "No presets registered"}
          </p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {filtered.map((entry) => {
              const isExpanded = expandedId === entry.id;
              return (
                <div key={entry.id} className="rounded hover:bg-neutral-800/60 transition-colors">
                  {/* Header row */}
                  <div className="flex items-center gap-1 px-2 py-1.5">
                    {/* Expand toggle */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                      className="text-[10px] text-neutral-600 hover:text-neutral-400 transition-colors w-3 flex-shrink-0"
                    >
                      {isExpanded ? "▼" : "▶"}
                    </button>
                    {/* Label + category */}
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-neutral-200 truncate block">
                        {entry.label}
                      </span>
                      <span className="text-[10px] text-neutral-600 truncate block">
                        {entry.category} · {entry.prompts.length} tags
                      </span>
                    </div>
                    {/* Add button */}
                    <button
                      onClick={(e) => handleAdd(entry, e.shiftKey)}
                      className="text-neutral-600 hover:text-sky-400 transition-colors text-xs flex-shrink-0 px-1"
                      title="Click: add to Positive / Shift+click: add to Negative"
                    >
                      +
                    </button>
                  </div>
                  {/* Expanded: show prompts */}
                  {isExpanded && (
                    <div className="px-2 pb-2 ml-4">
                      <div className="flex flex-wrap gap-1">
                        {entry.prompts.map((p, i) => (
                          <span
                            key={i}
                            className="text-[10px] bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded font-mono"
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                      {entry.note && (
                        <p className="text-[10px] text-neutral-600 mt-1">
                          {entry.note}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 pt-1 border-t border-neutral-800">
        <button
          onClick={onOpenManage}
          className="text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          Manage presets →
        </button>
      </div>
    </div>
  );
}
