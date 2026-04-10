"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { DEFAULT_GROUP_CATEGORIES } from "@/types";

interface DictionaryEntry {
  key: string;        // normalized tag key
  description: string;
  group?: string;
}

interface DictionaryViewProps {
  annotations: Record<string, string>;
  defaultGroups: Record<string, string>;
  onUpdateAnnotation: (key: string, description: string) => void;
  onDeleteAnnotation: (key: string) => void;
  onUpdateGroup: (key: string, group: string | null) => void;
  onOpenBulkNotes?: (json: string) => void;
}

export default function DictionaryView({
  annotations,
  defaultGroups,
  onUpdateAnnotation,
  onDeleteAnnotation,
  onUpdateGroup,
  onOpenBulkNotes,
}: DictionaryViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"flat" | "outline">("flat");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // --- Select mode ---
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  const exitSelectMode = useCallback(() => {
    setIsSelectMode(false);
    setSelectedKeys(new Set());
    setShowGroupDropdown(false);
    setNewGroupName("");
  }, []);

  const handleSelect = useCallback((key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // annotations + defaultGroups を統合して一覧を生成
  const allEntries = useMemo(() => {
    const keys = new Set([
      ...Object.keys(annotations),
      ...Object.keys(defaultGroups),
    ]);
    const entries: DictionaryEntry[] = [];
    for (const key of keys) {
      entries.push({
        key,
        description: annotations[key] ?? "",
        group: defaultGroups[key],
      });
    }
    entries.sort((a, b) => a.key.localeCompare(b.key));
    return entries;
  }, [annotations, defaultGroups]);

  // 検索フィルタ
  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return allEntries;
    const q = searchQuery.toLowerCase();
    return allEntries.filter(
      (e) =>
        e.key.includes(q) ||
        e.description.toLowerCase().includes(q) ||
        (e.group && e.group.toLowerCase().includes(q)),
    );
  }, [allEntries, searchQuery]);

  const toggleCollapse = useCallback((groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  // --- Bulk actions ---
  const handleBulkDelete = useCallback(() => {
    if (selectedKeys.size === 0) return;
    if (!window.confirm(`Delete ${selectedKeys.size} tag(s) from dictionary?`)) return;
    for (const key of selectedKeys) {
      onDeleteAnnotation(key);
      onUpdateGroup(key, null);
    }
    setSelectedKeys(new Set());
  }, [selectedKeys, onDeleteAnnotation, onUpdateGroup]);

  const handleBulkSetGroup = useCallback(
    (groupLabel: string) => {
      for (const key of selectedKeys) {
        onUpdateGroup(key, groupLabel);
      }
      setShowGroupDropdown(false);
      setSelectedKeys(new Set());
    },
    [selectedKeys, onUpdateGroup],
  );

  const handleSendToBulkNotes = useCallback(() => {
    if (selectedKeys.size === 0 || !onOpenBulkNotes) return;
    const entries = Array.from(selectedKeys).map((key) => ({
      tag: key,
      description: annotations[key] ?? "",
      group: defaultGroups[key] ?? "",
    }));
    onOpenBulkNotes(JSON.stringify(entries, null, 2));
  }, [selectedKeys, annotations, defaultGroups, onOpenBulkNotes]);

  return (
    <div>
      {/* ヘッダー */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-base font-medium text-neutral-100">Dictionary</h1>
          <p className="text-xs text-neutral-500 mt-1">
            {allEntries.length} tags — {Object.keys(annotations).length} annotated, {Object.keys(defaultGroups).length} grouped
          </p>
        </div>
      </div>

      {/* 検索 + ビュー切り替え */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tags, descriptions, groups..."
            className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-500 pr-8"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 text-sm"
            >
              ×
            </button>
          )}
        </div>
        {/* Select mode toggle */}
        <button
          onClick={() => {
            if (isSelectMode) exitSelectMode();
            else setIsSelectMode(true);
          }}
          className={`p-1.5 rounded transition-colors ${
            isSelectMode
              ? "text-sky-400 bg-sky-900/30"
              : "text-neutral-600 hover:text-neutral-400"
          }`}
          title={isSelectMode ? "Exit select mode" : "Enter select mode"}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            {isSelectMode ? (
              <>
                <rect x="1" y="1" width="5" height="5" rx="1" fill="currentColor" />
                <path d="M10 3h5M10 8h5M10 13h5M1 10h5" />
              </>
            ) : (
              <>
                <rect x="1" y="1" width="5" height="5" rx="1" />
                <path d="M10 3h5M10 8h5M10 13h5M1 10h5" />
              </>
            )}
          </svg>
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode("flat")}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
              viewMode === "flat"
                ? "bg-neutral-700 text-neutral-200"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 3h12M2 7h12M2 11h12" />
            </svg>
            Flat
          </button>
          <button
            onClick={() => setViewMode("outline")}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
              viewMode === "outline"
                ? "bg-neutral-700 text-neutral-200"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 2h5v5H2zM9 3h5M9 6h4M2 9h5v5H2zM9 10h5M9 13h4" />
            </svg>
            Outline
          </button>
        </div>
        <span className="text-[11px] text-neutral-600">
          {filteredEntries.length}{searchQuery ? " results" : " total"}
        </span>
      </div>

      {/* Select mode action bar */}
      {isSelectMode && (
        <div className="flex items-center gap-2 flex-wrap mb-3 bg-neutral-800/80 rounded-lg px-3 py-2">
          <span className="text-xs text-neutral-300">
            {selectedKeys.size} selected
          </span>
          <button
            onClick={() => setSelectedKeys(new Set(filteredEntries.map((e) => e.key)))}
            className="text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            All
          </button>
          <button
            onClick={() => setSelectedKeys(new Set())}
            className="text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            None
          </button>
          <div className="flex-1" />
          {/* Send to Bulk Notes */}
          {onOpenBulkNotes && (
            <button
              onClick={handleSendToBulkNotes}
              disabled={selectedKeys.size === 0}
              className="px-2 py-1 text-xs bg-sky-600 hover:bg-sky-500 text-white rounded transition-colors disabled:opacity-40"
              title="Send selected tags to Bulk Notes for re-annotation"
            >
              📝 Bulk Notes
            </button>
          )}
          {/* Set Group */}
          <div className="relative">
            <button
              onClick={() => setShowGroupDropdown((prev) => !prev)}
              disabled={selectedKeys.size === 0}
              className="px-2 py-1 text-xs bg-neutral-700 hover:bg-neutral-600 text-neutral-200 rounded transition-colors disabled:opacity-40"
            >
              Set Group ▼
            </button>
            {showGroupDropdown && (
              <div
                className="absolute top-full right-0 mt-1 bg-neutral-800 border border-neutral-600 rounded-lg shadow-xl py-1 min-w-[160px]"
                style={{ zIndex: 50 }}
              >
                {DEFAULT_GROUP_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => handleBulkSetGroup(cat)}
                    className="w-full text-left px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-700 transition-colors"
                  >
                    {cat}
                  </button>
                ))}
                <div className="border-t border-neutral-700 mt-1 pt-1 px-3 py-1">
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="Custom..."
                      className="flex-1 bg-neutral-900 border border-neutral-600 rounded px-2 py-1 text-xs text-neutral-200 focus:outline-none focus:border-neutral-400 min-w-0"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newGroupName.trim()) {
                          handleBulkSetGroup(newGroupName.trim());
                          setNewGroupName("");
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        if (newGroupName.trim()) {
                          handleBulkSetGroup(newGroupName.trim());
                          setNewGroupName("");
                        }
                      }}
                      className="px-2 py-1 text-xs bg-sky-600 hover:bg-sky-500 text-white rounded transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
                {/* Remove group */}
                <div className="border-t border-neutral-700 mt-1 pt-1">
                  <button
                    onClick={() => {
                      for (const key of selectedKeys) {
                        onUpdateGroup(key, null);
                      }
                      setShowGroupDropdown(false);
                      setSelectedKeys(new Set());
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-700 transition-colors"
                  >
                    Remove group
                  </button>
                </div>
              </div>
            )}
          </div>
          {/* Delete */}
          <button
            onClick={handleBulkDelete}
            disabled={selectedKeys.size === 0}
            className="px-2 py-1 text-xs bg-red-900/50 hover:bg-red-900/70 text-red-300 rounded transition-colors disabled:opacity-40"
          >
            Delete
          </button>
          <button
            onClick={exitSelectMode}
            className="px-2 py-1 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* フラットビュー */}
      {viewMode === "flat" && (
        <div className="flex flex-col gap-0.5">
          {filteredEntries.map((entry) => (
            <DictionaryRow
              key={entry.key}
              entry={entry}
              isSelectMode={isSelectMode}
              isSelected={selectedKeys.has(entry.key)}
              onSelect={handleSelect}
              onUpdateAnnotation={onUpdateAnnotation}
              onDeleteAnnotation={onDeleteAnnotation}
              onUpdateGroup={onUpdateGroup}
            />
          ))}
          {filteredEntries.length === 0 && (
            <p className="text-sm text-neutral-600 text-center py-8">
              {searchQuery ? "No matching tags" : "No tags registered yet"}
            </p>
          )}
        </div>
      )}

      {/* アウトラインビュー */}
      {viewMode === "outline" && (
        <div className="flex flex-col gap-3">
          {(() => {
            // グループごとに分類
            const grouped = new Map<string, DictionaryEntry[]>();
            const ungrouped: DictionaryEntry[] = [];

            for (const entry of filteredEntries) {
              if (entry.group) {
                const arr = grouped.get(entry.group) ?? [];
                arr.push(entry);
                grouped.set(entry.group, arr);
              } else {
                ungrouped.push(entry);
              }
            }

            // DEFAULT_GROUP_CATEGORIES順に並べ、その後にカスタムグループ
            const orderedGroupLabels = [
              ...DEFAULT_GROUP_CATEGORIES.filter((c) => grouped.has(c)),
              ...[...grouped.keys()].filter(
                (k) => !(DEFAULT_GROUP_CATEGORIES as readonly string[]).includes(k),
              ),
            ];

            return (
              <>
                {orderedGroupLabels.map((label) => {
                  const entries = grouped.get(label)!;
                  const isCollapsed = collapsedGroups.has(label);
                  const groupEntryKeys = entries.map((e) => e.key);
                  return (
                    <div key={label}>
                      <div className="flex items-center gap-2 px-2 py-1.5 bg-neutral-800/60 rounded-t border border-neutral-700/40">
                        <button
                          onClick={() => toggleCollapse(label)}
                          className="text-neutral-400 hover:text-neutral-200 transition-colors text-xs w-4"
                        >
                          {isCollapsed ? "▶" : "▼"}
                        </button>
                        <span
                          className={`text-xs font-medium text-sky-400/80 ${
                            isSelectMode ? "cursor-pointer hover:text-sky-300" : ""
                          }`}
                          onClick={
                            isSelectMode
                              ? () => {
                                  setSelectedKeys((prev) => {
                                    const next = new Set(prev);
                                    const allSelected = groupEntryKeys.every((k) => next.has(k));
                                    if (allSelected) {
                                      groupEntryKeys.forEach((k) => next.delete(k));
                                    } else {
                                      groupEntryKeys.forEach((k) => next.add(k));
                                    }
                                    return next;
                                  });
                                }
                              : undefined
                          }
                          title={isSelectMode ? "Select/deselect all in group" : undefined}
                        >
                          {label}
                        </span>
                        <span className="text-[10px] text-neutral-500">
                          ({entries.length})
                        </span>
                      </div>
                      {!isCollapsed && (
                        <div className="flex flex-col gap-0.5 border-x border-b border-neutral-700/40 rounded-b px-1 py-1">
                          {entries.map((entry) => (
                            <DictionaryRow
                              key={entry.key}
                              entry={entry}
                              isSelectMode={isSelectMode}
                              isSelected={selectedKeys.has(entry.key)}
                              onSelect={handleSelect}
                              onUpdateAnnotation={onUpdateAnnotation}
                              onDeleteAnnotation={onDeleteAnnotation}
                              onUpdateGroup={onUpdateGroup}
                              hideGroupBadge
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {ungrouped.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 px-2 py-1.5 bg-neutral-800/60 rounded-t border border-neutral-700/40">
                      <button
                        onClick={() => toggleCollapse("__ungrouped__")}
                        className="text-neutral-400 hover:text-neutral-200 transition-colors text-xs w-4"
                      >
                        {collapsedGroups.has("__ungrouped__") ? "▶" : "▼"}
                      </button>
                      <span
                        className={`text-xs font-medium text-neutral-400 ${
                          isSelectMode ? "cursor-pointer hover:text-neutral-200" : ""
                        }`}
                        onClick={
                          isSelectMode
                            ? () => {
                                const keys = ungrouped.map((e) => e.key);
                                setSelectedKeys((prev) => {
                                  const next = new Set(prev);
                                  const allSelected = keys.every((k) => next.has(k));
                                  if (allSelected) {
                                    keys.forEach((k) => next.delete(k));
                                  } else {
                                    keys.forEach((k) => next.add(k));
                                  }
                                  return next;
                                });
                              }
                            : undefined
                        }
                        title={isSelectMode ? "Select/deselect all ungrouped" : undefined}
                      >
                        Ungrouped
                      </span>
                      <span className="text-[10px] text-neutral-500">
                        ({ungrouped.length})
                      </span>
                    </div>
                    {!collapsedGroups.has("__ungrouped__") && (
                      <div className="flex flex-col gap-0.5 border-x border-b border-neutral-700/40 rounded-b px-1 py-1">
                        {ungrouped.map((entry) => (
                          <DictionaryRow
                            key={entry.key}
                            entry={entry}
                            isSelectMode={isSelectMode}
                            isSelected={selectedKeys.has(entry.key)}
                            onSelect={handleSelect}
                            onUpdateAnnotation={onUpdateAnnotation}
                            onDeleteAnnotation={onDeleteAnnotation}
                            onUpdateGroup={onUpdateGroup}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {filteredEntries.length === 0 && (
                  <p className="text-sm text-neutral-600 text-center py-8">
                    {searchQuery ? "No matching tags" : "No tags registered yet"}
                  </p>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// --- 1行コンポーネント ---

function DictionaryRow({
  entry,
  isSelectMode = false,
  isSelected = false,
  onSelect,
  onUpdateAnnotation,
  onDeleteAnnotation,
  onUpdateGroup,
  hideGroupBadge = false,
}: {
  entry: DictionaryEntry;
  isSelectMode?: boolean;
  isSelected?: boolean;
  onSelect?: (key: string) => void;
  onUpdateAnnotation: (key: string, description: string) => void;
  onDeleteAnnotation: (key: string) => void;
  onUpdateGroup: (key: string, group: string | null) => void;
  hideGroupBadge?: boolean;
}) {
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState(entry.description);
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);

  const commitDesc = () => {
    onUpdateAnnotation(entry.key, descValue);
    setIsEditingDesc(false);
  };

  const handleRowClick = () => {
    if (isSelectMode && onSelect) {
      onSelect(entry.key);
    }
  };

  return (
    <div
      className={`flex items-center gap-2 px-2.5 py-1.5 bg-neutral-800 rounded border transition-colors min-w-0 ${
        isSelectMode && isSelected
          ? "border-sky-500/60 bg-sky-900/20"
          : "border-neutral-700/60"
      } ${isSelectMode ? "cursor-pointer select-none" : ""}`}
      onClick={isSelectMode ? handleRowClick : undefined}
    >
      {/* Select mode: checkbox */}
      {isSelectMode && (
        <span className="flex items-center justify-center w-5 h-5 flex-shrink-0">
          <span
            className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
              isSelected
                ? "bg-sky-500 border-sky-500"
                : "border-neutral-500 hover:border-neutral-400"
            }`}
          >
            {isSelected && (
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
        </span>
      )}

      {/* タグ名 */}
      <span className="text-sm font-mono text-neutral-100 flex-shrink-0 min-w-[120px] max-w-[200px] truncate" title={entry.key}>
        {entry.key}
      </span>

      {/* 翻訳/説明 */}
      {isSelectMode ? (
        <span className={`flex-1 text-sm truncate min-w-0 ${
          entry.description ? "text-neutral-400" : "text-neutral-600 italic"
        }`}>
          {entry.description || "—"}
        </span>
      ) : isEditingDesc ? (
        <input
          type="text"
          value={descValue}
          onChange={(e) => setDescValue(e.target.value)}
          autoFocus
          className="flex-1 bg-neutral-900 border border-neutral-600 rounded px-2 py-1 text-sm text-neutral-200 focus:outline-none focus:border-sky-500 min-w-0"
          onBlur={commitDesc}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitDesc();
            if (e.key === "Escape") {
              setDescValue(entry.description);
              setIsEditingDesc(false);
            }
          }}
        />
      ) : (
        <span
          onClick={() => {
            setDescValue(entry.description);
            setIsEditingDesc(true);
          }}
          className={`flex-1 text-sm truncate min-w-0 cursor-text ${
            entry.description
              ? "text-neutral-400 hover:text-neutral-200"
              : "text-neutral-600 italic hover:text-neutral-400"
          }`}
          title={entry.description || "Click to add description"}
        >
          {entry.description || "—"}
        </span>
      )}

      {/* グループバッジ */}
      {!hideGroupBadge && !isSelectMode && (
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowGroupDropdown((p) => !p)}
            className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
              entry.group
                ? "text-sky-400/70 bg-sky-900/30 border border-sky-800/30 hover:bg-sky-900/50"
                : "text-neutral-500 hover:text-neutral-300 border border-dashed border-neutral-600 hover:border-neutral-400"
            }`}
            title={entry.group ? "Change group" : "Set group"}
          >
            {entry.group ?? (
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="inline-block">
                <path d="M1 3v5l7 6 5-5-6-7H2a1 1 0 0 0-1 1z" />
                <circle cx="5" cy="5" r="1" fill="currentColor" stroke="none" />
              </svg>
            )}
          </button>
          {showGroupDropdown && (
            <div
              className="absolute top-full right-0 mt-1 bg-neutral-800 border border-neutral-600 rounded-lg shadow-xl py-1 min-w-[140px]"
              style={{ zIndex: 50 }}
            >
              {DEFAULT_GROUP_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    onUpdateGroup(entry.key, cat);
                    setShowGroupDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                    entry.group === cat
                      ? "text-sky-400 bg-sky-900/30"
                      : "text-neutral-200 hover:bg-neutral-700"
                  }`}
                >
                  {cat}
                </button>
              ))}
              {entry.group && (
                <>
                  <div className="border-t border-neutral-700 my-1" />
                  <button
                    onClick={() => {
                      onUpdateGroup(entry.key, null);
                      setShowGroupDropdown(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-700 transition-colors"
                  >
                    Remove group
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
      {/* Select mode: group badge (read-only) */}
      {!hideGroupBadge && isSelectMode && entry.group && (
        <span className="text-[10px] text-sky-400/70 bg-sky-900/30 border border-sky-800/30 px-1.5 py-0.5 rounded flex-shrink-0">
          {entry.group}
        </span>
      )}

      {/* 削除 */}
      {!isSelectMode && (
        <button
          onClick={() => {
            if (window.confirm(`Delete "${entry.key}" from dictionary?`)) {
              onDeleteAnnotation(entry.key);
              onUpdateGroup(entry.key, null);
            }
          }}
          className="w-5 h-5 flex items-center justify-center text-neutral-700 hover:text-red-400 transition-colors flex-shrink-0"
          title="Delete"
        >
          ×
        </button>
      )}
    </div>
  );
}
