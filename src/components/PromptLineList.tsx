"use client";

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
import { PromptLine, createPromptLine } from "@/types";
import PromptLineItem from "./PromptLineItem";

interface PromptLineListProps {
  lines: PromptLine[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, newText: string) => void;
  onAdd: (line: PromptLine) => void;
  onReorder: (activeId: string, overId: string) => void;
}

export default function PromptLineList({
  lines,
  onToggle,
  onDelete,
  onUpdate,
  onAdd,
  onReorder,
}: PromptLineListProps) {
  // PointerSensorを使い、少し動かしてからドラッグ開始（クリックと区別するため）
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onReorder(active.id as string, over.id as string);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={lines.map((l) => l.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-1">
          {lines.map((line) => (
            <PromptLineItem
              key={line.id}
              line={line}
              onToggle={onToggle}
              onDelete={onDelete}
              onUpdate={onUpdate}
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
  );
}
