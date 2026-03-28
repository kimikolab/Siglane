"use client";

import { useState } from "react";
import { PromptLine } from "@/types";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface PromptLineItemProps {
  line: PromptLine;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, newText: string) => void;
}

export default function PromptLineItem({
  line,
  onToggle,
  onDelete,
  onUpdate,
}: PromptLineItemProps) {
  const [isEditing, setIsEditing] = useState(false);

  // dnd-kitのソート用フック
  // WPFでいうと: Thumb.DragDeltaイベントのハンドリングを全部やってくれるヘルパー
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: line.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-3 py-2 bg-neutral-800 rounded-lg border border-neutral-700 transition-opacity ${
        line.enabled ? "opacity-100" : "opacity-40"
      }`}
    >
      {/* ドラッグハンドル — listeners をここだけに付ける */}
      <span
        {...attributes}
        {...listeners}
        className="text-neutral-600 cursor-grab active:cursor-grabbing select-none"
      >
        ⠿
      </span>

      <button
        onClick={() => onToggle(line.id)}
        className={`w-8 h-[18px] rounded-full relative transition-colors ${
          line.enabled ? "bg-green-600" : "bg-neutral-600"
        }`}
      >
        <span
          className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform ${
            line.enabled ? "right-[2px]" : "left-[2px]"
          }`}
        />
      </button>

      {isEditing ? (
        <input
          type="text"
          defaultValue={line.text}
          autoFocus
          className="flex-1 bg-neutral-900 border border-neutral-600 rounded px-2 py-1 text-sm font-mono text-neutral-200 focus:outline-none focus:border-neutral-400"
          onBlur={(e) => {
            onUpdate(line.id, e.currentTarget.value);
            setIsEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onUpdate(line.id, e.currentTarget.value);
              setIsEditing(false);
            }
            if (e.key === "Escape") {
              setIsEditing(false);
            }
          }}
        />
      ) : (
        <span
          onClick={() => setIsEditing(true)}
          className={`flex-1 text-sm font-mono cursor-text ${
            line.enabled ? "text-neutral-200" : "text-neutral-500 line-through"
          }`}
        >
          {line.text}
        </span>
      )}

      <button
        onClick={() => onDelete(line.id)}
        className="text-neutral-600 hover:text-neutral-400 transition-colors"
      >
        ×
      </button>
    </div>
  );
}
