"use client";

import { useState, useRef, useEffect } from "react";
import { PromptLine, DEFAULT_GROUP_CATEGORIES, extractWeight, hasSpecialWeightSyntax, calcSpecialWeight } from "@/types";
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
  onSetLineGroup?: (id: string, groupLabel: string | null) => void;
  annotation?: string;
  onSetAnnotation?: (text: string, description: string) => void;
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
  onSetLineGroup,
  annotation,
  onSetAnnotation,
}: PromptLineItemProps) {
  const [isEditing, setIsEditing] = useState(line.text === "");
  const [isEditingWeight, setIsEditingWeight] = useState(false);
  const [weightInputValue, setWeightInputValue] = useState("");
  const weightInputRef = useRef<HTMLInputElement>(null);
  const [showBadgeDropdown, setShowBadgeDropdown] = useState(false);
  const [isEditingAnnotation, setIsEditingAnnotation] = useState(false);
  const [annotationValue, setAnnotationValue] = useState("");

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
      className={`flex items-center gap-1 ${isSelectMode ? "select-none" : ""}`}
    >
      {/* 行本体（枠付き） */}
      <div
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        onClick={isSelectMode ? handleRowClick : undefined}
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

        {/* ON/OFFトグル（選択モード中は無効化） */}
        <button
          onClick={(e) => {
            if (isSelectMode) { e.stopPropagation(); return; }
            onToggle(line.id);
          }}
          className={`w-8 h-[18px] rounded-full relative transition-colors flex-shrink-0 ${
            line.enabled ? "bg-green-600" : "bg-neutral-600"
          } ${isSelectMode ? "pointer-events-none" : ""}`}
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
          <div
            className={`flex-1 min-w-0 ${isSelectMode ? "cursor-pointer" : ""}`}
            onClick={() => { if (!isSelectMode && !isEditingAnnotation) setIsEditing(true); }}
          >
            <span
              className={`text-sm font-mono truncate block ${
                line.enabled ? "text-neutral-100" : "text-neutral-500 line-through"
              }`}
            >
              {line.text}
            </span>
            {/* アノテーション（注釈） */}
            {!isSelectMode && (
              isEditingAnnotation ? (
                <input
                  type="text"
                  value={annotationValue}
                  onChange={(e) => setAnnotationValue(e.target.value)}
                  autoFocus
                  placeholder="説明を入力..."
                  className="w-full bg-neutral-900 border border-neutral-600 rounded px-1.5 py-0.5 text-[11px] text-neutral-300 focus:outline-none focus:border-sky-500 mt-0.5"
                  onClick={(e) => e.stopPropagation()}
                  onBlur={() => {
                    if (onSetAnnotation) {
                      onSetAnnotation(line.text, annotationValue);
                    }
                    setIsEditingAnnotation(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      if (onSetAnnotation) {
                        onSetAnnotation(line.text, annotationValue);
                      }
                      setIsEditingAnnotation(false);
                    }
                    if (e.key === "Escape") {
                      setIsEditingAnnotation(false);
                    }
                    e.stopPropagation();
                  }}
                />
              ) : annotation ? (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setAnnotationValue(annotation);
                    setIsEditingAnnotation(true);
                  }}
                  className="text-[11px] text-neutral-500 truncate block cursor-text hover:text-neutral-400 mt-0.5"
                  title="Click to edit"
                >
                  {annotation}
                </span>
              ) : onSetAnnotation ? (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setAnnotationValue("");
                    setIsEditingAnnotation(true);
                  }}
                  className="text-[11px] text-neutral-700 hover:text-neutral-500 cursor-text mt-0.5 opacity-0 hover:opacity-100 transition-opacity"
                >
                  + 注釈
                </span>
              ) : null
            )}
          </div>
        )}

        {/* グループバッジ（クリックで変更可能） */}
        {!isEditing && !isSelectMode && onSetLineGroup && (
          <div className="relative flex-shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowBadgeDropdown((prev) => !prev);
              }}
              className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                groupLabel
                  ? "text-sky-400/70 bg-sky-900/30 border border-sky-800/30 hover:bg-sky-900/50"
                  : "text-neutral-500 hover:text-neutral-300 border border-dashed border-neutral-600 hover:border-neutral-400"
              }`}
              title={groupLabel ? "Change group" : "Set group"}
            >
              {groupLabel ?? (
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="inline-block">
                  <path d="M1 3v5l7 6 5-5-6-7H2a1 1 0 0 0-1 1z" />
                  <circle cx="5" cy="5" r="1" fill="currentColor" stroke="none" />
                </svg>
              )}
            </button>
            {showBadgeDropdown && (
              <div
                className="absolute top-full right-0 mt-1 bg-neutral-800 border border-neutral-600 rounded-lg shadow-xl py-1 min-w-[140px]"
                style={{ zIndex: 50 }}
              >
                {DEFAULT_GROUP_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSetLineGroup(line.id, cat);
                      setShowBadgeDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                      groupLabel === cat
                        ? "text-sky-400 bg-sky-900/30"
                        : "text-neutral-200 hover:bg-neutral-700"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
                {groupLabel && (
                  <>
                    <div className="border-t border-neutral-700 my-1" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSetLineGroup(line.id, null);
                        setShowBadgeDropdown(false);
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
        {/* 選択モード中はバッジ表示のみ */}
        {!isEditing && isSelectMode && groupLabel && (
          <span className="text-[10px] text-sky-400/70 bg-sky-900/30 border border-sky-800/30 px-1.5 py-0.5 rounded flex-shrink-0">
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
