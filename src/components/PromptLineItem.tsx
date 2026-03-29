"use client";

import { useState, useRef, useEffect } from "react";
import { PromptLine, extractWeight, hasSpecialWeightSyntax, calcSpecialWeight } from "@/types";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export type WeightMode = "combined" | "none";

interface PromptLineItemProps {
  line: PromptLine;
  weightMode: WeightMode;
  isSelectMode?: boolean;
  isSelected?: boolean;
  groupLabel?: string;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, newText: string) => void;
  onDuplicate: (id: string) => void;
  onWeightChange: (id: string, delta: number) => void;
  onWeightSet: (id: string, weight: number) => void;
  onSelect?: (id: string, shiftKey: boolean) => void;
}

export default function PromptLineItem({
  line,
  weightMode,
  isSelectMode = false,
  isSelected = false,
  groupLabel,
  onToggle,
  onDelete,
  onUpdate,
  onDuplicate,
  onWeightChange,
  onWeightSet,
  onSelect,
}: PromptLineItemProps) {
  const [isEditing, setIsEditing] = useState(line.text === "");
  const [isEditingWeight, setIsEditingWeight] = useState(false);
  const [weightInputValue, setWeightInputValue] = useState("");
  const weightInputRef = useRef<HTMLInputElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: line.id, disabled: isSelectMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "d") {
      e.preventDefault();
      onDuplicate(line.id);
    }
  };

  const handleRowClick = (e: React.MouseEvent) => {
    if (isSelectMode && onSelect) {
      e.preventDefault();
      e.stopPropagation();
      onSelect(line.id, e.shiftKey);
    }
  };

  const weight = extractWeight(line.text);
  const isWeighted = weight !== 1.0;

  const startWeightEdit = () => {
    setWeightInputValue(weight.toFixed(2));
    setIsEditingWeight(true);
  };

  const commitWeightEdit = () => {
    const parsed = parseFloat(weightInputValue);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 2) {
      const rounded = Math.round(parsed * 100) / 100;
      onWeightSet(line.id, rounded);
    }
    setIsEditingWeight(false);
  };

  useEffect(() => {
    if (isEditingWeight && weightInputRef.current) {
      weightInputRef.current.focus();
      weightInputRef.current.select();
    }
  }, [isEditingWeight]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-1"
      onClick={handleRowClick}
    >
      {/* 行本体（枠付き） */}
      <div
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={`flex-1 flex items-center gap-2 px-2.5 py-1.5 bg-neutral-800 rounded border transition-opacity focus:outline-none min-w-0 ${
          isSelectMode && isSelected
            ? "border-sky-500/60 bg-sky-900/20"
            : "border-neutral-700/60"
        } ${line.enabled ? "opacity-100" : "opacity-40"} ${
          isSelectMode ? "cursor-pointer" : ""
        }`}
      >
        {/* 選択モード: チェックボックス / 通常: ドラッグハンドル */}
        {isSelectMode ? (
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
        ) : (
          <span
            {...attributes}
            {...listeners}
            className="flex flex-col gap-[3px] py-1 px-0.5 cursor-grab active:cursor-grabbing select-none group/handle"
          >
            <span className="block w-3.5 h-[1.5px] bg-neutral-600 rounded-full group-hover/handle:bg-neutral-400 transition-colors" />
            <span className="block w-3.5 h-[1.5px] bg-neutral-600 rounded-full group-hover/handle:bg-neutral-400 transition-colors" />
            <span className="block w-3.5 h-[1.5px] bg-neutral-600 rounded-full group-hover/handle:bg-neutral-400 transition-colors" />
          </span>
        )}

        {/* ON/OFFトグル */}
        <button
          onClick={() => onToggle(line.id)}
          className={`w-8 h-[18px] rounded-full relative transition-colors flex-shrink-0 ${
            line.enabled ? "bg-green-600" : "bg-neutral-600"
          }`}
        >
          <span
            className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform ${
              line.enabled ? "right-[2px]" : "left-[2px]"
            }`}
          />
        </button>

        {/* テキスト */}
        {isEditing ? (
          <input
            type="text"
            defaultValue={line.text}
            autoFocus
            className="flex-1 bg-neutral-900 border border-neutral-600 rounded px-2 py-1 text-sm font-mono text-neutral-200 focus:outline-none focus:border-neutral-400 min-w-0"
            onBlur={(e) => {
              const val = e.currentTarget.value.trim();
              if (val === "") {
                onDelete(line.id);
              } else {
                onUpdate(line.id, val);
                setIsEditing(false);
              }
            }}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "d") {
                e.preventDefault();
                e.stopPropagation();
                onUpdate(line.id, e.currentTarget.value);
                setIsEditing(false);
                onDuplicate(line.id);
              }
              if (e.key === "Enter") {
                const val = e.currentTarget.value.trim();
                if (val === "") {
                  onDelete(line.id);
                } else {
                  onUpdate(line.id, val);
                  setIsEditing(false);
                }
              }
              if (e.key === "Escape") {
                if (line.text === "") {
                  onDelete(line.id);
                } else {
                  setIsEditing(false);
                }
              }
            }}
          />
        ) : (
          <span
            onClick={() => { if (!isSelectMode) setIsEditing(true); }}
            className={`flex-1 text-sm font-mono min-w-0 truncate ${
              isSelectMode ? "cursor-pointer" : "cursor-text"
            } ${
              line.enabled ? "text-neutral-100" : "text-neutral-500 line-through"
            }`}
          >
            {line.text}
          </span>
        )}

        {/* グループバッジ */}
        {groupLabel && !isEditing && (
          <span className="text-[10px] text-neutral-500 bg-neutral-700/50 px-1.5 py-0.5 rounded flex-shrink-0">
            {groupLabel}
          </span>
        )}

        {/* 重みコントロール */}
        {weightMode === "combined" && !isEditing && (
          hasSpecialWeightSyntax(line.text) ? (
            /* 特殊記法 — スライダー無効、実効重みだけ表示 */
            <span
              className="text-sm font-mono text-amber-600/70 flex-shrink-0"
              title="Special syntax — edit text directly to adjust"
            >
              {(calcSpecialWeight(line.text) ?? 1).toFixed(2)}
            </span>
          ) : (
            /* 通常テキスト — スライダー有効 */
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => onWeightChange(line.id, -0.05)}
                className="w-5 h-5 flex items-center justify-center text-xs text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700 rounded transition-colors"
                title="Decrease weight (-0.05)"
              >
                −
              </button>
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={weight}
                onChange={(e) => onWeightSet(line.id, parseFloat(e.target.value))}
                className="w-16 h-1 accent-sky-500 bg-neutral-600 rounded-full appearance-none cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-sky-400
                  [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-sky-400 [&::-moz-range-thumb]:border-0"
              />
              <button
                onClick={() => onWeightChange(line.id, 0.05)}
                className="w-5 h-5 flex items-center justify-center text-xs text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700 rounded transition-colors"
                title="Increase weight (+0.05)"
              >
                +
              </button>

              {/* 数値表示 / 直接入力 */}
              {isEditingWeight ? (
                <input
                  ref={weightInputRef}
                  type="text"
                  value={weightInputValue}
                  onChange={(e) => setWeightInputValue(e.target.value)}
                  onBlur={commitWeightEdit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitWeightEdit();
                    if (e.key === "Escape") setIsEditingWeight(false);
                  }}
                  className="w-12 bg-neutral-900 border border-neutral-500 rounded px-1 py-0.5 text-sm font-mono text-sky-400 text-center focus:outline-none focus:border-sky-500"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  onClick={startWeightEdit}
                  className={`text-sm font-mono w-9 text-center font-medium cursor-text hover:bg-neutral-700 rounded px-0.5 py-0.5 transition-colors ${
                    isWeighted ? "text-sky-400" : "text-neutral-500"
                  }`}
                  title="Click to edit weight directly"
                >
                  {weight.toFixed(2)}
                </span>
              )}
            </div>
          )
        )}
      </div>

      {/* 削除ボタン — 枠の外、常時表示 */}
      <button
        onClick={() => onDelete(line.id)}
        className="w-5 h-5 flex items-center justify-center text-neutral-700 hover:text-red-400 transition-colors flex-shrink-0"
        title="Delete line"
      >
        ×
      </button>
    </div>
  );
}
