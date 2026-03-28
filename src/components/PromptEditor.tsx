"use client";

import { PromptLine } from "@/types";
import PromptLineList from "./PromptLineList";

interface PromptEditorProps {
  positiveLines: PromptLine[];
  negativeLines: PromptLine[];
  onToggle: (type: "positive" | "negative", id: string) => void;
  onDelete: (type: "positive" | "negative", id: string) => void;
  onUpdate: (type: "positive" | "negative", id: string, text: string) => void;
  onAdd: (type: "positive" | "negative", line: PromptLine) => void;
  onReorder: (
    type: "positive" | "negative",
    activeId: string,
    overId: string,
  ) => void;
}

export default function PromptEditor({
  positiveLines,
  negativeLines,
  onToggle,
  onDelete,
  onUpdate,
  onAdd,
  onReorder,
}: PromptEditorProps) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-neutral-500 uppercase tracking-wider">
          Positive prompt
        </span>
        <div className="flex-1 h-px bg-neutral-700" />
      </div>

      <PromptLineList
        lines={positiveLines}
        onToggle={(id) => onToggle("positive", id)}
        onDelete={(id) => onDelete("positive", id)}
        onUpdate={(id, text) => onUpdate("positive", id, text)}
        onAdd={(line) => onAdd("positive", line)}
        onReorder={(activeId, overId) =>
          onReorder("positive", activeId, overId)
        }
      />

      <div className="flex items-center gap-2 mt-6 mb-3">
        <span className="text-xs text-amber-600 uppercase tracking-wider">
          Negative prompt
        </span>
        <div className="flex-1 h-px bg-neutral-700" />
      </div>

      <PromptLineList
        lines={negativeLines}
        onToggle={(id) => onToggle("negative", id)}
        onDelete={(id) => onDelete("negative", id)}
        onUpdate={(id, text) => onUpdate("negative", id, text)}
        onAdd={(line) => onAdd("negative", line)}
        onReorder={(activeId, overId) =>
          onReorder("negative", activeId, overId)
        }
      />
    </div>
  );
}
