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
  positiveCollapsed?: boolean;
  negativeCollapsed?: boolean;
  isSelectMode: boolean;
  selectedIds: Set<string>;
  onSelectedIdsChange: (updater: (prev: Set<string>) => Set<string>) => void;
  onTogglePositiveCollapse?: () => void;
  onToggleNegativeCollapse?: () => void;
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
  onReorderMultiple: (
    type: "positive" | "negative",
    movingIds: string[],
    activeId: string,
    overId: string,
  ) => void;
  onWeightChange: (type: "positive" | "negative", id: string, delta: number) => void;
  onWeightSet: (type: "positive" | "negative", id: string, weight: number) => void;
  onBulkToggle: (type: "positive" | "negative", lineIds: string[], enabled: boolean) => void;
  onSetLineGroup: (type: "positive" | "negative", id: string, groupLabel: string | null) => void;
  onReplaceGroup: (type: "positive" | "negative", groupId: string, groupLabel: string, newPrompts: string[]) => void;
  annotations: Record<string, string>;
  onSetAnnotation: (text: string, description: string) => void;
  groupCategories: string[];
}

export default function PromptEditor({
  positiveLines,
  negativeLines,
  positiveGroups,
  negativeGroups,
  weightMode,
  viewMode,
  positiveCollapsed = false,
  negativeCollapsed = false,
  isSelectMode,
  selectedIds,
  onSelectedIdsChange,
  onTogglePositiveCollapse,
  onToggleNegativeCollapse,
  onToggle,
  onDelete,
  onUpdate,
  onAdd,
  onDuplicate,
  onReorder,
  onReorderMultiple,
  onWeightChange,
  onWeightSet,
  onBulkToggle,
  onSetLineGroup,
  onReplaceGroup,
  annotations,
  onSetAnnotation,
  groupCategories,
}: PromptEditorProps) {
  return (
    <div>
      {/* Positive section header */}
      {onTogglePositiveCollapse && (
        <button
          onClick={onTogglePositiveCollapse}
          className="flex items-center gap-1.5 mb-1"
        >
          <span className="text-[10px] text-neutral-600 hover:text-neutral-400 transition-colors">
            {positiveCollapsed ? "▶" : "▼"}
          </span>
          <span className="text-xs uppercase tracking-wider text-neutral-300">
            Positive prompt
          </span>
          <span className="text-[10px] text-neutral-600">
            ({positiveLines.length})
          </span>
        </button>
      )}
      {!positiveCollapsed && (
        <PromptLineList
          sectionLabel={onTogglePositiveCollapse ? "" : "Positive prompt"}
          sectionColor="text-neutral-300"
          lines={positiveLines}
          groups={positiveGroups}
          weightMode={weightMode}
          viewMode={viewMode}
          isSelectMode={isSelectMode}
          selectedIds={selectedIds}
          onSelectedIdsChange={onSelectedIdsChange}
          annotations={annotations}
          onSetAnnotation={onSetAnnotation}
          onToggle={(id) => onToggle("positive", id)}
          onDelete={(id) => onDelete("positive", id)}
          onUpdate={(id, text) => onUpdate("positive", id, text)}
          onAdd={(line) => onAdd("positive", line)}
          onDuplicate={(id) => onDuplicate("positive", id)}
          onReorder={(activeId, overId) =>
            onReorder("positive", activeId, overId)
          }
          onReorderMultiple={(movingIds, activeId, overId) =>
            onReorderMultiple("positive", movingIds, activeId, overId)
          }
          onWeightChange={(id, delta) => onWeightChange("positive", id, delta)}
          onWeightSet={(id, weight) => onWeightSet("positive", id, weight)}
          onBulkToggle={(ids, enabled) => onBulkToggle("positive", ids, enabled)}
          onSetLineGroup={(id, label) => onSetLineGroup("positive", id, label)}
          onReplaceGroup={(gid, label, prompts) => onReplaceGroup("positive", gid, label, prompts)}
          groupCategories={groupCategories}
        />
      )}

      <div className="mt-4" />

      {/* Negative section header */}
      {onToggleNegativeCollapse && (
        <button
          onClick={onToggleNegativeCollapse}
          className="flex items-center gap-1.5 mb-1"
        >
          <span className="text-[10px] text-neutral-600 hover:text-neutral-400 transition-colors">
            {negativeCollapsed ? "▶" : "▼"}
          </span>
          <span className="text-xs uppercase tracking-wider text-amber-800">
            Negative prompt
          </span>
          <span className="text-[10px] text-neutral-600">
            ({negativeLines.length})
          </span>
        </button>
      )}
      {!negativeCollapsed && (
        <PromptLineList
          sectionLabel={onToggleNegativeCollapse ? "" : "Negative prompt"}
          sectionColor="text-amber-800"
          lines={negativeLines}
          groups={negativeGroups}
          weightMode={weightMode}
          viewMode={viewMode}
          isSelectMode={isSelectMode}
          selectedIds={selectedIds}
          onSelectedIdsChange={onSelectedIdsChange}
          annotations={annotations}
          onSetAnnotation={onSetAnnotation}
          onToggle={(id) => onToggle("negative", id)}
          onDelete={(id) => onDelete("negative", id)}
          onUpdate={(id, text) => onUpdate("negative", id, text)}
          onAdd={(line) => onAdd("negative", line)}
          onDuplicate={(id) => onDuplicate("negative", id)}
          onReorder={(activeId, overId) =>
            onReorder("negative", activeId, overId)
          }
          onReorderMultiple={(movingIds, activeId, overId) =>
            onReorderMultiple("negative", movingIds, activeId, overId)
          }
          onWeightChange={(id, delta) => onWeightChange("negative", id, delta)}
          onWeightSet={(id, weight) => onWeightSet("negative", id, weight)}
          onBulkToggle={(ids, enabled) => onBulkToggle("negative", ids, enabled)}
          onSetLineGroup={(id, label) => onSetLineGroup("negative", id, label)}
          onReplaceGroup={(gid, label, prompts) => onReplaceGroup("negative", gid, label, prompts)}
          groupCategories={groupCategories}
        />
      )}
    </div>
  );
}
