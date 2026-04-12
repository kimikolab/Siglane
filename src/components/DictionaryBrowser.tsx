"use client";

import { useState, useMemo, useCallback } from "react";
import type { PromptLine } from "@/types";
import { normalizeForLookup } from "@/utils/annotations";
import type { NegativeTags } from "@/utils/negativeTags";

interface DictionaryBrowserProps {
  annotations: Record<string, string>;
  defaultGroups: Record<string, string>;
  negativeTags: NegativeTags;
  /** Current session positive lines (for "already added" check) */
  positiveLines: PromptLine[];
  /** Current session negative lines */
  negativeLines: PromptLine[];
  /** Add tag to positive or negative */
  onAddTag: (type: "positive" | "negative", tag: string) => void;
  /** Open full dictionary management view */
  onOpenManage: () => void;
}

// Group badge colors (same palette as PromptLineList)
const GROUP_COLORS: Record<string, string> = {
  Quality: "bg-emerald-900/60 text-emerald-300",
  Character: "bg-violet-900/60 text-violet-300",
  Hair: "bg-pink-900/60 text-pink-300",
  Eyes: "bg-cyan-900/60 text-cyan-300",
  Expression: "bg-yellow-900/60 text-yellow-300",
  Clothing: "bg-blue-900/60 text-blue-300",
  Accessories: "bg-orange-900/60 text-orange-300",
  Background: "bg-teal-900/60 text-teal-300",
  Pose: "bg-rose-900/60 text-rose-300",
  Style: "bg-indigo-900/60 text-indigo-300",
};

function getGroupColor(group: string): string {
  return GROUP_COLORS[group] ?? "bg-neutral-700/60 text-neutral-300";
}

export default function DictionaryBrowser({
  annotations,
  defaultGroups,
  negativeTags,
  positiveLines,
  negativeLines,
  onAddTag,
  onOpenManage,
}: DictionaryBrowserProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "positive" | "negative">("all");

  // Build entries from annotations + defaultGroups
  const entries = useMemo(() => {
    const allKeys = new Set<string>();
    for (const k of Object.keys(annotations)) allKeys.add(k);
    for (const k of Object.keys(defaultGroups)) allKeys.add(k);

    return Array.from(allKeys)
      .map((key) => ({
        key,
        description: annotations[key] ?? "",
        group: defaultGroups[key] ?? "",
        isNegative: !!negativeTags[key],
      }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [annotations, defaultGroups, negativeTags]);

  // Unique groups for filter
  const availableGroups = useMemo(() => {
    const groups = new Set<string>();
    for (const e of entries) {
      if (e.group) groups.add(e.group);
    }
    return Array.from(groups).sort();
  }, [entries]);

  // Filter
  const filtered = useMemo(() => {
    let result = entries;
    // Type filter (P/N)
    if (typeFilter === "positive") {
      result = result.filter((e) => !e.isNegative);
    } else if (typeFilter === "negative") {
      result = result.filter((e) => e.isNegative);
    }
    if (groupFilter !== "all") {
      if (groupFilter === "__ungrouped__") {
        result = result.filter((e) => !e.group);
      } else {
        result = result.filter((e) => e.group === groupFilter);
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.key.includes(q) ||
          e.description.toLowerCase().includes(q) ||
          e.group.toLowerCase().includes(q),
      );
    }
    return result;
  }, [entries, groupFilter, searchQuery, typeFilter]);

  // Set of normalized keys currently in session
  const existingKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const l of positiveLines) {
      keys.add(normalizeForLookup(l.text));
    }
    for (const l of negativeLines) {
      keys.add(normalizeForLookup(l.text));
    }
    return keys;
  }, [positiveLines, negativeLines]);

  const handleClick = useCallback(
    (key: string, isNegative: boolean, shiftKey: boolean) => {
      // Shift reverses the default target
      // Negative tags default to negative, others to positive
      const defaultTarget = isNegative ? "negative" : "positive";
      const target = shiftKey
        ? defaultTarget === "positive"
          ? "negative"
          : "positive"
        : defaultTarget;
      onAddTag(target, key);
    },
    [onAddTag],
  );

  return (
    <div className="flex flex-col gap-2 h-full">
      {/* Search + filter */}
      <div className="flex flex-col gap-1.5 flex-shrink-0">
        <input
          type="text"
          placeholder="Search tags..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-neutral-800 border border-neutral-700 rounded px-2.5 py-1.5 text-xs text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500"
        />
        <div className="flex items-center gap-1.5">
          {/* P/N filter */}
          <div className="flex gap-0.5 bg-neutral-800 rounded p-0.5">
            {(["all", "positive", "negative"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${
                  typeFilter === t
                    ? "bg-neutral-700 text-neutral-200"
                    : "text-neutral-500 hover:text-neutral-300"
                }`}
              >
                {t === "all" ? "All" : t === "positive" ? "P" : "N"}
              </button>
            ))}
          </div>
          {/* Group filter */}
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="flex-1 min-w-0 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-[11px] text-neutral-300 focus:outline-none focus:border-neutral-500"
          >
            <option value="all">All groups</option>
            <option value="__ungrouped__">Ungrouped</option>
            {availableGroups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <span className="text-[10px] text-neutral-600 whitespace-nowrap">
            {filtered.length}/{entries.length}
          </span>
        </div>
      </div>

      {/* Tag list */}
      <div className="flex-1 overflow-y-auto sidebar-scroll min-h-0">
        {filtered.length === 0 ? (
          <p className="text-xs text-neutral-600 text-center py-6">
            {searchQuery ? "No matching tags" : "No tags registered"}
          </p>
        ) : (
          <div className="flex flex-col">
            {filtered.map((entry) => {
              const alreadyAdded = existingKeys.has(entry.key);
              return (
                <button
                  key={entry.key}
                  onClick={(e) =>
                    handleClick(entry.key, entry.isNegative, e.shiftKey)
                  }
                  className={`text-left px-2 py-1.5 rounded transition-colors group ${
                    alreadyAdded
                      ? "bg-neutral-800/30 hover:bg-neutral-700/40"
                      : "hover:bg-neutral-800/60"
                  }`}
                  title={
                    entry.isNegative
                      ? "Click: add to Negative / Shift+click: add to Positive"
                      : "Click: add to Positive / Shift+click: add to Negative"
                  }
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    {/* Check mark for already added */}
                    {alreadyAdded && (
                      <span className="text-[10px] text-green-600 flex-shrink-0">
                        ✓
                      </span>
                    )}
                    {/* Tag name */}
                    <span
                      className={`text-xs font-mono truncate ${
                        alreadyAdded
                          ? "text-neutral-500"
                          : entry.isNegative
                            ? "text-amber-400"
                            : "text-neutral-200"
                      }`}
                    >
                      {entry.key}
                    </span>
                    <div className="flex-1" />
                    {/* Group badge */}
                    {entry.group && (
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded flex-shrink-0 ${getGroupColor(entry.group)}`}
                      >
                        {entry.group}
                      </span>
                    )}
                    {/* N badge for negative tags */}
                    {entry.isNegative && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-amber-900/40 text-amber-500 flex-shrink-0">
                        N
                      </span>
                    )}
                    {/* + indicator on hover */}
                    <span className="text-neutral-700 group-hover:text-neutral-400 text-xs flex-shrink-0 transition-colors">
                      +
                    </span>
                  </div>
                  {/* Annotation (1 line) */}
                  {entry.description && (
                    <p className="text-[10px] text-neutral-600 truncate mt-0.5 pl-0.5">
                      {entry.description}
                    </p>
                  )}
                </button>
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
          Manage dictionary →
        </button>
      </div>
    </div>
  );
}
