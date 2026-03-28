"use client";

import { useState, useEffect } from "react";
import {
  SiglaneState,
  PromptLine,
  parsePrompt,
  joinPromptLines,
  joinAllPromptLines,
} from "@/types";
import InputArea from "@/components/InputArea";
import PromptEditor from "@/components/PromptEditor";
import MemoBox from "@/components/MemoBox";

const STORAGE_KEY = "siglane-state";

const defaultState: SiglaneState = {
  positiveLines: [],
  negativeLines: [],
  memo: "",
};

export default function Home() {
  const [state, setState] = useState<SiglaneState>(defaultState);

  // localStorage読み込み
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setState(JSON.parse(saved));
      } catch {
        // パース失敗時はデフォルトのまま
      }
    }
  }, []);

  // 自動保存
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // テキストエリア → グリッド同期（blur時に呼ばれる）
  const handleSyncPositive = (text: string) => {
    setState((prev) => ({
      ...prev,
      positiveLines: parsePrompt(text),
    }));
  };

  const handleSyncNegative = (text: string) => {
    setState((prev) => ({
      ...prev,
      negativeLines: parsePrompt(text),
    }));
  };

  // グリッド操作のコールバック群
  const handleToggle = (type: "positive" | "negative", id: string) => {
    const key = type === "positive" ? "positiveLines" : "negativeLines";
    setState((prev) => ({
      ...prev,
      [key]: prev[key].map((line: PromptLine) =>
        line.id === id ? { ...line, enabled: !line.enabled } : line,
      ),
    }));
  };

  const handleDelete = (type: "positive" | "negative", id: string) => {
    const key = type === "positive" ? "positiveLines" : "negativeLines";
    setState((prev) => ({
      ...prev,
      [key]: prev[key].filter((line: PromptLine) => line.id !== id),
    }));
  };

  const handleUpdate = (
    type: "positive" | "negative",
    id: string,
    newText: string,
  ) => {
    const key = type === "positive" ? "positiveLines" : "negativeLines";
    const parsed = parsePrompt(newText);

    if (parsed.length <= 1) {
      // 分割不要 — そのまま更新
      setState((prev) => ({
        ...prev,
        [key]: prev[key].map((line: PromptLine) =>
          line.id === id ? { ...line, text: newText.trim() } : line,
        ),
      }));
    } else {
      // カンマで複数要素に分割 — 元の行を置き換え
      setState((prev) => {
        const lines = [...prev[key]];
        const index = lines.findIndex((l: PromptLine) => l.id === id);
        if (index === -1) return prev;
        lines.splice(index, 1, ...parsed);
        return { ...prev, [key]: lines };
      });
    }
  };

  const handleAdd = (type: "positive" | "negative", line: PromptLine) => {
    const key = type === "positive" ? "positiveLines" : "negativeLines";
    setState((prev) => ({
      ...prev,
      [key]: [...prev[key], line],
    }));
  };

  const handleDuplicate = (type: "positive" | "negative", id: string) => {
    const key = type === "positive" ? "positiveLines" : "negativeLines";
    setState((prev) => {
      const lines = [...prev[key]];
      const index = lines.findIndex((l: PromptLine) => l.id === id);
      if (index === -1) return prev;
      const original = lines[index];
      const copy: PromptLine = {
        id: crypto.randomUUID(),
        text: original.text,
        enabled: original.enabled,
      };
      lines.splice(index + 1, 0, copy);
      return { ...prev, [key]: lines };
    });
  };

  const handleReorder = (
    type: "positive" | "negative",
    activeId: string,
    overId: string,
  ) => {
    const key = type === "positive" ? "positiveLines" : "negativeLines";
    setState((prev) => {
      const lines = [...prev[key]];
      const oldIndex = lines.findIndex((l: PromptLine) => l.id === activeId);
      const newIndex = lines.findIndex((l: PromptLine) => l.id === overId);
      const [moved] = lines.splice(oldIndex, 1);
      lines.splice(newIndex, 0, moved);
      return { ...prev, [key]: lines };
    });
  };

  const handleMemoChange = (memo: string) => {
    setState((prev) => ({ ...prev, memo }));
  };

  // テキストエリア用の文字列を算出
  const positiveAllText = joinAllPromptLines(state.positiveLines);
  const negativeAllText = joinAllPromptLines(state.negativeLines);
  const positiveCopyText = joinPromptLines(state.positiveLines);
  const negativeCopyText = joinPromptLines(state.negativeLines);

  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100">
      <div className="max-w-4xl mx-auto p-6">
        {/* テキストエリア（P/N横並び） */}
        <div className="space-y-4 mb-6">
          <InputArea
            label="Positive"
            rows={5}
            allText={positiveAllText}
            copyText={positiveCopyText}
            onSync={handleSyncPositive}
          />
          <InputArea
            label="Negative"
            rows={2}
            labelColor="text-amber-800"
            allText={negativeAllText}
            copyText={negativeCopyText}
            onSync={handleSyncNegative}
          />
        </div>

        {/* グリッド */}
        <div className="mb-6">
          <PromptEditor
            positiveLines={state.positiveLines}
            negativeLines={state.negativeLines}
            onToggle={handleToggle}
            onDelete={handleDelete}
            onUpdate={handleUpdate}
            onAdd={handleAdd}
            onDuplicate={handleDuplicate}
            onReorder={handleReorder}
          />
        </div>

        {/* メモ */}
        <MemoBox memo={state.memo} onMemoChange={handleMemoChange} />
      </div>
    </div>
  );
}
