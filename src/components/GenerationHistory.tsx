"use client";

import { useState } from "react";
import type { GenerationHistoryEntry } from "@/types";

interface GenerationHistoryProps {
  entries: GenerationHistoryEntry[];
  comfyConnected: boolean;
}

export default function GenerationHistory({
  entries,
  comfyConnected,
}: GenerationHistoryProps) {
  const [expanded, setExpanded] = useState(true);

  if (entries.length === 0) return null;

  return (
    <div className="mt-4">
      <button
        onClick={() => setExpanded((p) => !p)}
        className="flex items-center gap-2 mb-2 group"
      >
        <span className="text-xs text-neutral-500 group-hover:text-neutral-300 transition-colors">
          {expanded ? "▼" : "▶"}
        </span>
        <span className="text-xs uppercase tracking-wider text-neutral-400">
          History
        </span>
        <span className="text-[10px] text-neutral-600">
          ({entries.length})
        </span>
      </button>

      {expanded && (
        <div className="space-y-2">
          {entries
            .slice()
            .reverse()
            .map((entry) => (
              <HistoryEntry
                key={entry.id}
                entry={entry}
                comfyConnected={comfyConnected}
              />
            ))}
        </div>
      )}
    </div>
  );
}

function HistoryEntry({
  entry,
  comfyConnected,
}: {
  entry: GenerationHistoryEntry;
  comfyConnected: boolean;
}) {
  const [showParams, setShowParams] = useState(false);
  const date = new Date(entry.createdAt);
  const timeStr = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateStr = date.toLocaleDateString();

  const ov = entry.overrides;
  const seedStr =
    typeof ov.seed === "number" ? String(ov.seed) : "random";

  return (
    <div className="bg-neutral-800/50 border border-neutral-700/40 rounded-lg px-3 py-2">
      {/* ヘッダー行 */}
      <div className="flex items-center gap-2 text-[11px]">
        <span className="text-neutral-500">{dateStr}</span>
        <span className="text-neutral-400">{timeStr}</span>
        <span className="text-neutral-700">|</span>
        <span className="text-neutral-500">
          seed:{" "}
          <span className="text-neutral-300 font-mono">{seedStr}</span>
        </span>
        <span className="text-neutral-500">
          steps:{" "}
          <span className="text-neutral-300 font-mono">{ov.steps}</span>
        </span>
        <span className="text-neutral-500">
          cfg:{" "}
          <span className="text-neutral-300 font-mono">{ov.cfg}</span>
        </span>
        <div className="flex-1" />
        <button
          onClick={() => setShowParams((p) => !p)}
          className="text-neutral-600 hover:text-neutral-400 transition-colors"
          title="Show full parameters"
        >
          {showParams ? "−" : "+"}
        </button>
      </div>

      {/* 画像サムネイル */}
      {entry.imageUrls.length > 0 && (
        <div className="flex gap-2 mt-2 overflow-x-auto">
          {entry.imageUrls.map((url, i) => (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`gen-${i}`}
                className="h-24 w-auto rounded border border-neutral-700 hover:border-neutral-500 transition-colors object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </a>
          ))}
          {!comfyConnected && (
            <div className="flex items-center text-[10px] text-neutral-600 px-2">
              ComfyUI offline — images unavailable
            </div>
          )}
        </div>
      )}
      {entry.imageUrls.length === 0 && (
        <div className="text-[10px] text-neutral-600 mt-1">
          No images captured
        </div>
      )}

      {/* 詳細パラメータ（展開時） */}
      {showParams && (
        <div className="mt-2 pt-2 border-t border-neutral-700/40 text-[11px] space-y-1">
          <div className="text-neutral-500">
            sampler:{" "}
            <span className="text-neutral-300 font-mono">
              {ov.samplerName}
            </span>
            {" / "}scheduler:{" "}
            <span className="text-neutral-300 font-mono">
              {ov.scheduler}
            </span>
            {ov.denoise !== 1.0 && (
              <>
                {" / "}denoise:{" "}
                <span className="text-neutral-300 font-mono">
                  {ov.denoise}
                </span>
              </>
            )}
          </div>
          <div className="text-neutral-600 truncate" title={entry.positivePrompt}>
            P: {entry.positivePrompt.slice(0, 120)}
            {entry.positivePrompt.length > 120 ? "..." : ""}
          </div>
          {entry.negativePrompt && (
            <div
              className="text-neutral-600 truncate"
              title={entry.negativePrompt}
            >
              N: {entry.negativePrompt.slice(0, 80)}
              {entry.negativePrompt.length > 80 ? "..." : ""}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
