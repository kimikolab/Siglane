"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
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

// 初回アクセス時に表示するサンプル（クライアント側でのみ生成）
function createSampleState(): SiglaneState {
  return {
    positiveLines: parsePrompt(
      "masterpiece, best quality, 1girl, smile, blue hair, (soft lighting:1.2), <lora:add_detail:0.8>, bokeh"
    ),
    negativeLines: parsePrompt(
      "worst quality, low quality, normal quality, lowres"
    ),
    memo: "seed: 12345 / cfg: 7 / steps: 28 / model: animagine-xl",
  };
}

const emptyState: SiglaneState = {
  positiveLines: [],
  negativeLines: [],
  memo: "",
};

export default function Home() {
  const [state, setState] = useState<SiglaneState>(emptyState);
  const [loaded, setLoaded] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const isInitial = useRef(true);

  // localStorage読み込み（なければサンプルを表示）
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setState(JSON.parse(saved));
      } catch {
        setState(createSampleState());
      }
    } else {
      setState(createSampleState());
    }
    setLoaded(true);
  }, []);

  // 自動保存（初回ロード時は保存しない）
  useEffect(() => {
    if (!loaded) return;
    if (isInitial.current) {
      isInitial.current = false;
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setSavedFlash(true);
    const timer = setTimeout(() => setSavedFlash(false), 1500);
    return () => clearTimeout(timer);
  }, [state, loaded]);

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

  const [showHelp, setShowHelp] = useState(false);

  // ?キーでヘルプ表示
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.key === "?" || (e.key === "/" && e.shiftKey)) && !e.ctrlKey && !e.metaKey) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        setShowHelp((prev) => !prev);
      }
      if (e.key === "Escape") {
        setShowHelp(false);
      }
    };
    window.addEventListener("keydown", handleGlobalKey);
    return () => window.removeEventListener("keydown", handleGlobalKey);
  }, []);

  // テキストエリア用の文字列を算出
  const positiveAllText = joinAllPromptLines(state.positiveLines);
  const negativeAllText = joinAllPromptLines(state.negativeLines);
  const positiveCopyText = joinPromptLines(state.positiveLines);
  const negativeCopyText = joinPromptLines(state.negativeLines);

  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100">
      <div className="max-w-4xl mx-auto p-6">
        {/* ステータスバー */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setShowHelp(true)}
            className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors"
          >
            Shortcuts &amp; Tips
          </button>
          <span
            className={`text-xs transition-colors duration-500 ${
              savedFlash ? "text-green-500" : "text-neutral-600"
            }`}
          >
            {savedFlash ? "Saved ✓" : "Auto-saved locally"}
          </span>
        </div>

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

      {/* ヘルプオーバーレイ（Portalでbody直下に描画） */}
      {showHelp && createPortal(
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
          onClick={() => setShowHelp(false)}
        >
          <div
            style={{
              backgroundColor: "#262626",
              border: "1px solid #404040",
              borderRadius: "8px",
              padding: "24px",
              maxWidth: "384px",
              width: "100%",
              margin: "0 16px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-neutral-200">Keyboard shortcuts</h2>
              <button
                onClick={() => setShowHelp(false)}
                className="text-neutral-500 hover:text-neutral-300 transition-colors"
              >
                ×
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-400">Duplicate line</span>
                <kbd className="text-neutral-300 bg-neutral-700 px-1.5 py-0.5 rounded text-xs font-mono">Ctrl+D</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Confirm edit</span>
                <kbd className="text-neutral-300 bg-neutral-700 px-1.5 py-0.5 rounded text-xs font-mono">Enter</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Cancel edit</span>
                <kbd className="text-neutral-300 bg-neutral-700 px-1.5 py-0.5 rounded text-xs font-mono">Esc</kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Show this help</span>
                <kbd className="text-neutral-300 bg-neutral-700 px-1.5 py-0.5 rounded text-xs font-mono">?</kbd>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-neutral-700 space-y-1.5 text-xs text-neutral-500">
              <p>Click a line to edit it</p>
              <p>Drag the handle to reorder</p>
              <p>Toggle to include / exclude from output</p>
              <p>Changes are saved automatically</p>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
