"use client";

import { useState, useRef, useCallback } from "react";
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
  DEFAULT_GROUP_CATEGORIES,
  createPromptLine,
} from "@/types";
import PromptLineItem, { WeightMode } from "./PromptLineItem";

interface PromptLineListProps {
  sectionLabel: string;
  sectionColor?: string;
  lines: PromptLine[];
  groups?: PromptGroup[];
  weightMode: WeightMode;
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
}

export default function PromptLineList({
  sectionLabel,
  sectionColor = "text-neutral-300",
  lines,
  groups,
  weightMode,
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
}: PromptLineListProps) {
  // --- 選択モード（セクション内部管理） ---
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const lastSelectedId = useRef<string | null>(null);
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  const exitSelectMode = useCallback(() => {
    setIsSelectMode(false);
    setSelectedIds(new Set());
    lastSelectedId.current = null;
    setShowGroupDropdown(false);
    setNewGroupName("");
  }, []);

  const handleSelect = useCallback(
    (id: string, shiftKey: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (shiftKey && lastSelectedId.current) {
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

  // DnD: 選択モード中はセンサー無効
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 5 },
  });
  const sensors = useSensors(isSelectMode ? undefined : pointerSensor);

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
        <span className={`text-xs uppercase tracking-wider ${sectionColor}`}>
          {sectionLabel}
        </span>
        <div className="flex-1 h-px bg-neutral-700" />
      </div>

      {/* アクションバー（選択モード中のみ） */}
      {isSelectMode && (
        <div className="flex items-center gap-2 flex-wrap mb-2 bg-neutral-800/80 rounded-lg px-3 py-2">
          <span className="text-xs text-neutral-300">
            {selectedIds.size} selected
          </span>
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
    </div>
  );
}
