"use client";

import { PromptLine, PromptGroup } from "@/types";
import PromptLineList from "./PromptLineList";
import { WeightMode } from "./PromptLineItem";

interface PromptEditorProps {
  positiveLines: PromptLine[];
  negativeLines: PromptLine[];
  positiveGroups?: PromptGroup[];
  negativeGroups?: PromptGroup[];
  weightMode: WeightMode;
  viewMode: "flat" | "outline";
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
  onSetGroup: (type: "positive" | "negative", lineIds: string[], groupLabel: string) => void;
  onBulkToggle: (type: "positive" | "negative", lineIds: string[], enabled: boolean) => void;
  onUngroup: (type: "positive" | "negative", lineIds: string[]) => void;
  onSetLineGroup: (type: "positive" | "negative", id: string, groupLabel: string | null) => void;
  onReplaceGroup: (type: "positive" | "negative", groupId: string, groupLabel: string, newPrompts: string[]) => void;
}

export default function PromptEditor({
  positiveLines,
  negativeLines,
  positiveGroups,
  negativeGroups,
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
}: PromptEditorProps) {
  return (
    <div>
      <PromptLineList
        sectionLabel="Positive prompt"
        sectionColor="text-neutral-300"
        lines={positiveLines}
        groups={positiveGroups}
        weightMode={weightMode}
        viewMode={viewMode}
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
        onSetGroup={(ids, label) => onSetGroup("positive", ids, label)}
        onBulkToggle={(ids, enabled) => onBulkToggle("positive", ids, enabled)}
        onUngroup={(ids) => onUngroup("positive", ids)}
        onSetLineGroup={(id, label) => onSetLineGroup("positive", id, label)}
        onReplaceGroup={(gid, label, prompts) => onReplaceGroup("positive", gid, label, prompts)}
      />

      <div className="mt-4" />

      <PromptLineList
        sectionLabel="Negative prompt"
        sectionColor="text-amber-800"
        lines={negativeLines}
        groups={negativeGroups}
        weightMode={weightMode}
        viewMode={viewMode}
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
        onSetGroup={(ids, label) => onSetGroup("negative", ids, label)}
        onBulkToggle={(ids, enabled) => onBulkToggle("negative", ids, enabled)}
        onUngroup={(ids) => onUngroup("negative", ids)}
        onSetLineGroup={(id, label) => onSetLineGroup("negative", id, label)}
        onReplaceGroup={(gid, label, prompts) => onReplaceGroup("negative", gid, label, prompts)}
      />
    </div>
  );
}
