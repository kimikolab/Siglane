"use client";

import { useState, useCallback, useEffect } from "react";
import type { GenerationHistoryEntry } from "@/types";

interface GenerationHistoryProps {
  entries: GenerationHistoryEntry[];
  comfyConnected: boolean;
  onClear?: () => void;
}

export default function GenerationHistory({
  entries,
  comfyConnected,
  onClear,
}: GenerationHistoryProps) {
  const [expanded, setExpanded] = useState(true);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const closeLightbox = useCallback(() => setLightboxUrl(null), []);

  useEffect(() => {
    if (!lightboxUrl) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxUrl, closeLightbox]);

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
      {expanded && onClear && (
        <button
          onClick={() => {
            if (window.confirm("Clear all generation history for this session?")) {
              onClear();
            }
          }}
          className="text-[10px] text-neutral-600 hover:text-red-400 transition-colors mb-2 ml-5"
        >
          Clear history
        </button>
      )}

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
                onImageClick={setLightboxUrl}
              />
            ))}
        </div>
      )}

      {/* Lightbox overlay */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 cursor-pointer"
          onClick={closeLightbox}
        >
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 text-neutral-400 hover:text-white text-2xl leading-none"
            aria-label="Close"
          >
            ✕
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="Preview"
            className="max-h-[90vh] max-w-[90vw] object-contain rounded"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

function HistoryEntry({
  entry,
  comfyConnected,
  onImageClick,
}: {
  entry: GenerationHistoryEntry;
  comfyConnected: boolean;
  onImageClick: (url: string) => void;
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
            <button
              key={i}
              onClick={() => onImageClick(url)}
              className="flex-shrink-0"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`gen-${i}`}
                className="h-40 w-auto rounded border border-neutral-700 hover:border-neutral-400 transition-colors object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </button>
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
