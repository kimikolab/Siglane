"use client";

import { PromptLine } from "@/types";
import PromptLineList from "./PromptLineList";
import { WeightMode } from "./PromptLineItem";

interface PromptEditorProps {
  positiveLines: PromptLine[];
  negativeLines: PromptLine[];
  weightMode: WeightMode;
  onToggle: (type: "positive" | "negative", id: string) => void;
  onDelete: (type: "positive" | "negative", id: string) => void;
  onUpdate: (type: "positive" | "negative", id: string, text: string) => void;
  onAdd: (type: "positive" | "negative", line: PromptLine) => void;
  onDuplicate: (type: "positive" | "negative", id: string) => void;
  onReorder: (
    type: "positive" | "negative",
    activeId: string,
    overId: string,
  ) => void;
  onWeightChange: (type: "positive" | "negative", id: string, delta: number) => void;
  onWeightSet: (type: "positive" | "negative", id: string, weight: number) => void;
}

export default function PromptEditor({
  positiveLines,
  negativeLines,
  weightMode,
  onToggle,
  onDelete,
  onUpdate,
  onAdd,
  onDuplicate,
  onReorder,
  onWeightChange,
  onWeightSet,
}: PromptEditorProps) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-neutral-300 uppercase tracking-wider">
          Positive prompt
        </span>
        <div className="flex-1 h-px bg-neutral-700" />
      </div>

      <PromptLineList
        lines={positiveLines}
        weightMode={weightMode}
        onToggle={(id) => onToggle("positive", id)}
        onDelete={(id) => onDelete("positive", id)}
        onUpdate={(id, text) => onUpdate("positive", id, text)}
        onAdd={(line) => onAdd("positive", line)}
        onDuplicate={(id) => onDuplicate("positive", id)}
        onReorder={(activeId, overId) =>
          onReorder("positive", activeId, overId)
        }
        onWeightChange={(id, delta) => onWeightChange("positive", id, delta)}
        onWeightSet={(id, weight) => onWeightSet("positive", id, weight)}
      />

      <div className="flex items-center gap-2 mt-4 mb-2">
        <span className="text-xs text-amber-800 uppercase tracking-wider">
          Negative prompt
        </span>
        <div className="flex-1 h-px bg-neutral-700" />
      </div>

      <PromptLineList
        lines={negativeLines}
        weightMode={weightMode}
        onToggle={(id) => onToggle("negative", id)}
        onDelete={(id) => onDelete("negative", id)}
        onUpdate={(id, text) => onUpdate("negative", id, text)}
        onAdd={(line) => onAdd("negative", line)}
        onDuplicate={(id) => onDuplicate("negative", id)}
        onReorder={(activeId, overId) =>
          onReorder("negative", activeId, overId)
        }
        onWeightChange={(id, delta) => onWeightChange("negative", id, delta)}
        onWeightSet={(id, weight) => onWeightSet("negative", id, weight)}
      />
    </div>
  );
}
