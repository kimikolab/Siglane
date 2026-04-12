"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  PromptLine,
  PromptGroup,
  DictionaryEntry,
  DEFAULT_GROUP_CATEGORIES,
  createPromptLine,
} from "@/types";
import PromptLineItem, { WeightMode } from "./PromptLineItem";
import {
  addEntry,
  createEntry,
  getEntriesByCategory,
} from "@/utils/dictionary";
import { getAnnotation, normalizeForLookup } from "@/utils/annotations";

interface PromptLineListProps {
  sectionLabel: string;
  sectionColor?: string;
  lines: PromptLine[];
  groups?: PromptGroup[];
  weightMode: WeightMode;
  viewMode: "flat" | "outline";
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, newText: string) => void;
  onAdd: (line: PromptLine) => void;
  onDuplicate: (id: string) => void;
  onReorder: (activeId: string, overId: string) => void;
  onWeightChange: (id: string, delta: number) => void;
  onWeightSet: (id: string, weight: number) => void;
  onSetGroup: (lineIds: string[], groupLabel: string) => void;
  onBulkToggle: (lineIds: string[], enabled: boolean) => void;
  onUngroup: (lineIds: string[]) => void;
  onSetLineGroup: (id: string, groupLabel: string | null) => void;
  onReplaceGroup: (groupId: string, groupLabel: string, newPrompts: string[]) => void;
  onReplaceSelection: (selectedIds: string[], groupLabel: string, newPrompts: string[]) => void;
  annotations: Record<string, string>;
  onSetAnnotation: (text: string, description: string) => void;
}

export default function PromptLineList({
  sectionLabel,
  sectionColor = "text-neutral-300",
  lines,
  groups,
  weightMode,
  viewMode,
  onToggle,
  onDelete,
  onUpdate,
  onAdd,
  onDuplicate,
  onReorder,
  onWeightChange,
  onWeightSet,
  onSetGroup,
  onBulkToggle,
  onUngroup,
  onSetLineGroup,
  onReplaceGroup,
  onReplaceSelection,
  annotations,
  onSetAnnotation,
}: PromptLineListProps) {
  // --- 選択モード（セクション内部管理） ---
  // --- 重複プロンプト検出 ---
  const duplicateKeys = useMemo(() => {
    const counts = new Map<string, number>();
    for (const line of lines) {
      const key = normalizeForLookup(line.text);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const dups = new Set<string>();
    for (const [key, count] of counts) {
      if (count > 1) dups.add(key);
    }
    return dups;
  }, [lines]);

  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const lastSelectedId = useRef<string | null>(null);
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  // --- アウトラインビューの折りたたみ ---
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  // --- プリセット保存/差し替え ---
  const [savingGroupId, setSavingGroupId] = useState<string | null>(null);
  const [savePresetName, setSavePresetName] = useState("");
  const [replacingGroupId, setReplacingGroupId] = useState<string | null>(null);
  const [presetToast, setPresetToast] = useState<string | null>(null);
  // --- 選択行からのプリセット保存 ---
  const [savingFromSelection, setSavingFromSelection] = useState(false);
  const [selectionPresetName, setSelectionPresetName] = useState("");
  const [selectionPresetCategory, setSelectionPresetCategory] = useState("");
  const [showSelectionCategoryDropdown, setShowSelectionCategoryDropdown] = useState(false);
  // --- 選択行のプリセット差し替え ---
  const [showSelectionReplaceDropdown, setShowSelectionReplaceDropdown] = useState(false);

  const exitSelectMode = useCallback(() => {
    setIsSelectMode(false);
    setSelectedIds(new Set());
    lastSelectedId.current = null;
    setShowGroupDropdown(false);
    setNewGroupName("");
    setSavingFromSelection(false);
    setSelectionPresetName("");
    setSelectionPresetCategory("");
    setShowSelectionCategoryDropdown(false);
    setShowSelectionReplaceDropdown(false);
  }, []);

  // --- Shiftキー追跡（イベントバブリングに依存しない） ---
  const shiftHeld = useRef(false);
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === "Shift") shiftHeld.current = true; };
    const up = (e: KeyboardEvent) => { if (e.key === "Shift") shiftHeld.current = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // --- プリセットトースト自動消去 ---
  useEffect(() => {
    if (!presetToast) return;
    const timer = setTimeout(() => setPresetToast(null), 2500);
    return () => clearTimeout(timer);
  }, [presetToast]);

  const handleSelect = useCallback(
    (id: string, _shiftKey: boolean) => {
      const isShift = shiftHeld.current;
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (isShift && lastSelectedId.current) {
          const lastIdx = lines.findIndex(
            (l) => l.id === lastSelectedId.current,
          );
          const curIdx = lines.findIndex((l) => l.id === id);
          if (lastIdx !== -1 && curIdx !== -1) {
            const [from, to] =
              lastIdx < curIdx ? [lastIdx, curIdx] : [curIdx, lastIdx];
            for (let i = from; i <= to; i++) {
              next.add(lines[i].id);
            }
          }
        } else {
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
        }
        lastSelectedId.current = id;
        return next;
      });
    },
    [lines],
  );

  const handleSetGroupAction = useCallback(
    (label: string) => {
      if (selectedIds.size === 0) return;
      onSetGroup(Array.from(selectedIds), label);
      setShowGroupDropdown(false);
      setSelectedIds(new Set());
    },
    [selectedIds, onSetGroup],
  );

  // DnD: 選択モード中は発火距離を極大にして実質無効化（配列サイズ変更の警告回避）
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: isSelectMode ? 999999 : 5 },
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onReorder(active.id as string, over.id as string);
    }
  };

  const selectedArray = Array.from(selectedIds);

  return (
    <div>
      {/* セクションヘッダー */}
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={() => {
            if (isSelectMode) exitSelectMode();
            else setIsSelectMode(true);
          }}
          className={`p-1 rounded transition-colors ${
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
        {sectionLabel && (
          <span className={`text-xs uppercase tracking-wider ${sectionColor}`}>
            {sectionLabel}
          </span>
        )}
        <div className="flex-1 h-px bg-neutral-700" />
      </div>

      {/* アクションバー（選択モード中のみ） */}
      {isSelectMode && (
        <div className="flex items-center gap-2 flex-wrap mb-2 bg-neutral-800/80 rounded-lg px-3 py-2">
          <span className="text-xs text-neutral-300">
            {selectedIds.size} selected
          </span>
          {/* Select All / Deselect All */}
          <button
            onClick={() =>
              setSelectedIds(new Set(lines.map((l) => l.id)))
            }
            className="text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            All
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            None
          </button>
          <div className="flex-1" />
          {/* Set Group */}
          <div className="relative">
            <button
              onClick={() => setShowGroupDropdown((prev) => !prev)}
              disabled={selectedIds.size === 0}
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
                    onClick={() => handleSetGroupAction(cat)}
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
                          handleSetGroupAction(newGroupName.trim());
                          setNewGroupName("");
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        if (newGroupName.trim()) {
                          handleSetGroupAction(newGroupName.trim());
                          setNewGroupName("");
                        }
                      }}
                      className="px-2 py-1 text-xs bg-sky-600 hover:bg-sky-500 text-white rounded transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          {/* Save selection as preset */}
          {savingFromSelection ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={selectionPresetName}
                onChange={(e) => setSelectionPresetName(e.target.value)}
                placeholder="Preset name..."
                autoFocus
                className="w-24 bg-neutral-900 border border-neutral-600 rounded px-1.5 py-0.5 text-[11px] text-neutral-200 focus:outline-none focus:border-sky-500"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && selectionPresetName.trim() && selectionPresetCategory.trim()) {
                    const prompts = lines.filter((l) => selectedIds.has(l.id)).map((l) => l.text);
                    addEntry(createEntry(selectionPresetName.trim(), selectionPresetCategory.trim(), prompts));
                    setPresetToast(`Saved "${selectionPresetName.trim()}" to dictionary`);
                    setSavingFromSelection(false);
                    setSelectionPresetName("");
                    setSelectionPresetCategory("");
                  }
                  if (e.key === "Escape") {
                    setSavingFromSelection(false);
                    setSelectionPresetName("");
                    setSelectionPresetCategory("");
                  }
                }}
              />
              <div className="relative">
                <button
                  onClick={() => setShowSelectionCategoryDropdown((p) => !p)}
                  className="px-1.5 py-0.5 text-[11px] bg-neutral-700 hover:bg-neutral-600 text-neutral-300 rounded truncate max-w-[100px]"
                >
                  {selectionPresetCategory || "Category ▼"}
                </button>
                {showSelectionCategoryDropdown && (
                  <div
                    className="absolute top-full right-0 mt-1 bg-neutral-800 border border-neutral-600 rounded-lg shadow-xl py-1 min-w-[140px]"
                    style={{ zIndex: 50 }}
                  >
                    {DEFAULT_GROUP_CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => {
                          setSelectionPresetCategory(cat);
                          setShowSelectionCategoryDropdown(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-700 transition-colors"
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  setSavingFromSelection(false);
                  setSelectionPresetName("");
                  setSelectionPresetCategory("");
                }}
                className="px-1 py-0.5 text-[10px] text-neutral-500 hover:text-neutral-300"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                // 選択行が全て同じグループなら、そのグループ名をカテゴリ初期値にする
                const selectedGroupIds = new Set(
                  lines.filter((l) => selectedIds.has(l.id)).map((l) => l.groupId).filter(Boolean),
                );
                const label = selectedGroupIds.size === 1
                  ? groups?.find((g) => g.id === Array.from(selectedGroupIds)[0])?.label ?? ""
                  : "";
                setSavingFromSelection(true);
                setSelectionPresetCategory(label);
              }}
              disabled={selectedIds.size === 0}
              className="px-1.5 py-0.5 text-[10px] text-neutral-500 hover:text-neutral-300 transition-colors disabled:opacity-40"
              title="Save selection as preset"
            >
              💾
            </button>
          )}
          {/* Replace selection with preset */}
          <div className="relative">
            <button
              onClick={() => {
                setShowSelectionReplaceDropdown((p) => !p);
                setSavingFromSelection(false);
              }}
              disabled={selectedIds.size === 0}
              className="px-1.5 py-0.5 text-[10px] text-neutral-500 hover:text-neutral-300 transition-colors disabled:opacity-40"
              title="Replace selection with preset"
            >
              🔄
            </button>
            {showSelectionReplaceDropdown && (
              <div
                className="absolute top-full right-0 mt-1 bg-neutral-800 border border-neutral-600 rounded-lg shadow-xl py-1 min-w-[200px] max-h-[300px] overflow-y-auto"
                style={{ zIndex: 50 }}
              >
                {(() => {
                  const allCategories = DEFAULT_GROUP_CATEGORIES;
                  // 選択行のグループを優先表示
                  const selectedGroupIds = new Set(
                    lines.filter((l) => selectedIds.has(l.id)).map((l) => l.groupId).filter(Boolean),
                  );
                  const priorityLabel = selectedGroupIds.size === 1
                    ? groups?.find((g) => g.id === Array.from(selectedGroupIds)[0])?.label
                    : undefined;
                  const categoriesToShow = priorityLabel
                    ? [priorityLabel, ...allCategories.filter((c) => c !== priorityLabel)]
                    : allCategories;

                  let hasAny = false;
                  return (
                    <>
                      {categoriesToShow.map((cat) => {
                        const presets = getEntriesByCategory(cat);
                        if (presets.length === 0) return null;
                        hasAny = true;
                        return (
                          <div key={cat}>
                            <p className="px-3 py-1 text-[10px] text-neutral-500 font-medium border-b border-neutral-700">
                              {cat}
                            </p>
                            {presets.map((preset) => (
                              <button
                                key={preset.id}
                                onClick={() => {
                                  onReplaceSelection(selectedArray, cat, preset.prompts);
                                  setShowSelectionReplaceDropdown(false);
                                  setSelectedIds(new Set());
                                  setPresetToast(`Replaced with "${preset.label}"`);
                                }}
                                className="w-full text-left px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-700 transition-colors"
                                title={preset.prompts.join(", ")}
                              >
                                <span className="font-medium">{preset.label}</span>
                                <span className="text-neutral-500 ml-1.5">({preset.prompts.length})</span>
                              </button>
                            ))}
                          </div>
                        );
                      })}
                      {!hasAny && (
                        <p className="px-3 py-2 text-xs text-neutral-500">No presets available</p>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
          <button
            onClick={() => {
              onBulkToggle(selectedArray, true);
              setSelectedIds(new Set());
            }}
            disabled={selectedIds.size === 0}
            className="px-2 py-1 text-xs bg-green-800/50 hover:bg-green-800/70 text-green-300 rounded transition-colors disabled:opacity-40"
          >
            ON
          </button>
          <button
            onClick={() => {
              onBulkToggle(selectedArray, false);
              setSelectedIds(new Set());
            }}
            disabled={selectedIds.size === 0}
            className="px-2 py-1 text-xs bg-neutral-700 hover:bg-neutral-600 text-neutral-300 rounded transition-colors disabled:opacity-40"
          >
            OFF
          </button>
          <button
            onClick={() => {
              onUngroup(selectedArray);
              setSelectedIds(new Set());
            }}
            disabled={selectedIds.size === 0}
            className="px-2 py-1 text-xs bg-neutral-700 hover:bg-neutral-600 text-neutral-400 rounded transition-colors disabled:opacity-40"
          >
            Ungroup
          </button>
          <button
            onClick={exitSelectMode}
            className="px-2 py-1 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* 行リスト */}
      {viewMode === "flat" ? (
        /* --- フラットビュー --- */
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={lines.map((l) => l.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-0.5">
              {lines.map((line) => (
                <PromptLineItem
                  key={line.id}
                  line={line}
                  weightMode={weightMode}
                  isSelectMode={isSelectMode}
                  isSelected={selectedIds.has(line.id)}
                  groupLabel={
                    line.groupId
                      ? groups?.find((g) => g.id === line.groupId)?.label
                      : undefined
                  }
                  onToggle={onToggle}
                  onDelete={onDelete}
                  onUpdate={onUpdate}
                  onDuplicate={onDuplicate}
                  onWeightChange={onWeightChange}
                  onWeightSet={onWeightSet}
                  onSelect={handleSelect}
                  onSetLineGroup={onSetLineGroup}
                  annotation={getAnnotation(annotations, line.text)}
                  onSetAnnotation={onSetAnnotation}
                  isDuplicate={duplicateKeys.has(normalizeForLookup(line.text))}
                />
              ))}

              <button
                onClick={() => onAdd(createPromptLine(""))}
                className="flex justify-center py-1 text-neutral-600 hover:text-neutral-400 border border-dashed border-neutral-700 rounded-lg transition-colors"
              >
                +
              </button>
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        /* --- アウトラインビュー --- */
        <div className="flex flex-col gap-3">
          {(() => {
            // グループごとに行を分類
            const groupedLines = new Map<string, PromptLine[]>();
            const ungrouped: PromptLine[] = [];
            const sortedGroups = [...(groups ?? [])].sort(
              (a, b) => a.order - b.order,
            );

            for (const line of lines) {
              if (line.groupId) {
                const arr = groupedLines.get(line.groupId) ?? [];
                arr.push(line);
                groupedLines.set(line.groupId, arr);
              } else {
                ungrouped.push(line);
              }
            }

            const renderGroup = (
              groupId: string,
              label: string,
              groupLines: PromptLine[],
            ) => {
              const isCollapsed = collapsedGroups.has(groupId);
              const enabledCount = groupLines.filter((l) => l.enabled).length;
              const allEnabled = enabledCount === groupLines.length;
              const groupLineIds = groupLines.map((l) => l.id);

              return (
                <div key={groupId}>
                  {/* グループヘッダー */}
                  <div className="flex items-center gap-2 px-2 py-1.5 bg-neutral-800/60 rounded-t border border-neutral-700/40">
                    <button
                      onClick={() =>
                        setCollapsedGroups((prev) => {
                          const next = new Set(prev);
                          if (next.has(groupId)) next.delete(groupId);
                          else next.add(groupId);
                          return next;
                        })
                      }
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
                              setSelectedIds((prev) => {
                                const next = new Set(prev);
                                const allSelected = groupLineIds.every((id) =>
                                  next.has(id),
                                );
                                if (allSelected) {
                                  groupLineIds.forEach((id) =>
                                    next.delete(id),
                                  );
                                } else {
                                  groupLineIds.forEach((id) => next.add(id));
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
                      ({enabledCount}/{groupLines.length})
                    </span>
                    <div className="flex-1" />
                    {/* Save / Replace（Ungroupedセクション以外） */}
                    {groupId !== "__ungrouped__" && !isSelectMode && (
                      <div className="flex items-center gap-1">
                        {/* Save preset */}
                        {savingGroupId === groupId ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={savePresetName}
                              onChange={(e) => setSavePresetName(e.target.value)}
                              placeholder="Preset name..."
                              autoFocus
                              className="w-28 bg-neutral-900 border border-neutral-600 rounded px-1.5 py-0.5 text-[11px] text-neutral-200 focus:outline-none focus:border-sky-500"
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && savePresetName.trim()) {
                                  const prompts = groupLines.map((l) => l.text);
                                  addEntry(
                                    createEntry(savePresetName.trim(), label, prompts),
                                  );
                                  setSavingGroupId(null);
                                  setSavePresetName("");
                                  setPresetToast(`Saved "${savePresetName.trim()}" to dictionary`);
                                }
                                if (e.key === "Escape") {
                                  setSavingGroupId(null);
                                  setSavePresetName("");
                                }
                              }}
                              onBlur={() => {
                                setSavingGroupId(null);
                                setSavePresetName("");
                              }}
                            />
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setSavingGroupId(groupId);
                              setReplacingGroupId(null);
                            }}
                            className="px-1.5 py-0.5 text-[10px] text-neutral-500 hover:text-neutral-300 transition-colors"
                            title="Save as preset"
                          >
                            💾
                          </button>
                        )}
                        {/* Replace */}
                        <div className="relative">
                          <button
                            onClick={() => {
                              setReplacingGroupId(
                                replacingGroupId === groupId ? null : groupId,
                              );
                              setSavingGroupId(null);
                            }}
                            className="px-1.5 py-0.5 text-[10px] text-neutral-500 hover:text-neutral-300 transition-colors"
                            title="Replace with preset"
                          >
                            🔄
                          </button>
                          {replacingGroupId === groupId && (
                            <div
                              className="absolute top-full right-0 mt-1 bg-neutral-800 border border-neutral-600 rounded-lg shadow-xl py-1 min-w-[180px] max-h-[240px] overflow-y-auto"
                              style={{ zIndex: 50 }}
                            >
                              {(() => {
                                const presets = getEntriesByCategory(label);
                                if (presets.length === 0) {
                                  return (
                                    <p className="px-3 py-2 text-xs text-neutral-500">
                                      No presets for &quot;{label}&quot;
                                    </p>
                                  );
                                }
                                return presets.map((preset) => (
                                  <button
                                    key={preset.id}
                                    onClick={() => {
                                      onReplaceGroup(groupId, label, preset.prompts);
                                      setReplacingGroupId(null);
                                      setPresetToast(
                                        `Replaced with "${preset.label}"`,
                                      );
                                    }}
                                    className="w-full text-left px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-700 transition-colors"
                                    title={preset.prompts.join(", ")}
                                  >
                                    <span className="font-medium">
                                      {preset.label}
                                    </span>
                                    <span className="text-neutral-500 ml-1.5">
                                      ({preset.prompts.length})
                                    </span>
                                  </button>
                                ));
                              })()}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    <button
                      onClick={() => onBulkToggle(groupLineIds, !allEnabled)}
                      className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${
                        allEnabled
                          ? "bg-green-800/40 text-green-400 hover:bg-green-800/60"
                          : "bg-neutral-700/50 text-neutral-400 hover:bg-neutral-700"
                      }`}
                      title={allEnabled ? "Turn all OFF" : "Turn all ON"}
                    >
                      {allEnabled ? "ON" : "OFF"}
                    </button>
                  </div>
                  {/* グループ内の行 */}
                  {!isCollapsed && (
                    <div className="flex flex-col gap-0.5 border-x border-b border-neutral-700/40 rounded-b px-1 py-1">
                      {groupLines.map((line) => (
                        <PromptLineItem
                          key={line.id}
                          line={line}
                          weightMode={weightMode}
                          isSelectMode={isSelectMode}
                          isSelected={selectedIds.has(line.id)}
                          onToggle={onToggle}
                          onDelete={onDelete}
                          onUpdate={onUpdate}
                          onDuplicate={onDuplicate}
                          onWeightChange={onWeightChange}
                          onWeightSet={onWeightSet}
                          onSelect={handleSelect}
                          onSetLineGroup={onSetLineGroup}
                          annotation={getAnnotation(annotations, line.text)}
                          onSetAnnotation={onSetAnnotation}
                          isDuplicate={duplicateKeys.has(normalizeForLookup(line.text))}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            };

            return (
              <>
                {sortedGroups.map((group) => {
                  const groupLines = groupedLines.get(group.id);
                  if (!groupLines || groupLines.length === 0) return null;
                  return renderGroup(group.id, group.label, groupLines);
                })}
                {ungrouped.length > 0 &&
                  renderGroup("__ungrouped__", "Ungrouped", ungrouped)}
              </>
            );
          })()}
        </div>
      )}

      {/* プリセットトースト */}
      {presetToast && (
        <div className="mt-2 px-3 py-1.5 bg-green-900/60 border border-green-700/40 rounded text-xs text-green-300">
          {presetToast}
        </div>
      )}
    </div>
  );
}
