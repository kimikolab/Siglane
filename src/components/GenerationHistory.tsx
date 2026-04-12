"use client";

import { useState, useCallback, useEffect } from "react";
import type { GenerationHistoryEntry } from "@/types";

interface GenerationHistoryProps {
  entries: GenerationHistoryEntry[];
  comfyConnected: boolean;
  onClear?: () => void;
  onToggleFavorite?: (entryId: string) => void;
}

async function downloadImage(url: string, filename: string) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch {
    // Fallback: open in new tab
    window.open(url, "_blank");
  }
}

export default function GenerationHistory({
  entries,
  comfyConnected,
  onClear,
  onToggleFavorite,
}: GenerationHistoryProps) {
  const [expanded, setExpanded] = useState(true);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const closeLightbox = useCallback(() => setLightboxUrl(null), []);

  useEffect(() => {
    if (!lightboxUrl) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxUrl, closeLightbox]);

  if (entries.length === 0) {
    return (
      <div className="text-xs text-neutral-600 text-center mt-8">
        No generation history yet.
        <br />
        <span className="text-neutral-700">
          Import a workflow and hit Generate to start.
        </span>
      </div>
    );
  }

  const favoriteCount = entries.filter((e) => e.isFavorite).length;
  const displayEntries = showFavoritesOnly
    ? entries.filter((e) => e.isFavorite)
    : entries;

  return (
    <div>
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
        <div className="flex items-center gap-2 mb-2 ml-1">
          {favoriteCount > 0 && (
            <button
              onClick={() => setShowFavoritesOnly((p) => !p)}
              className={`text-[11px] transition-colors ${
                showFavoritesOnly
                  ? "text-amber-400"
                  : "text-neutral-600 hover:text-neutral-400"
              }`}
              title={showFavoritesOnly ? "Show all" : "Show favorites only"}
            >
              ★ {favoriteCount}
            </button>
          )}
          <div className="flex-1" />
          {onClear && (
            <button
              onClick={() => {
                if (window.confirm("Clear all generation history for this session?")) {
                  onClear();
                }
              }}
              className="text-[10px] text-neutral-600 hover:text-red-400 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {expanded && (
        <div className="space-y-2">
          {displayEntries
            .slice()
            .reverse()
            .map((entry) => (
              <HistoryEntry
                key={entry.id}
                entry={entry}
                comfyConnected={comfyConnected}
                onImageClick={setLightboxUrl}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          {displayEntries.length === 0 && showFavoritesOnly && (
            <div className="text-xs text-neutral-600 text-center py-4">
              No favorites yet
            </div>
          )}
        </div>
      )}

      {/* Lightbox overlay */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 cursor-pointer"
          onClick={closeLightbox}
        >
          <div className="absolute top-4 right-4 flex items-center gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                const filename = lightboxUrl.split("filename=")[1]?.split("&")[0] ?? "image.png";
                downloadImage(lightboxUrl, filename);
              }}
              className="text-neutral-400 hover:text-white text-sm transition-colors"
              title="Download image"
            >
              ⬇
            </button>
            <button
              onClick={closeLightbox}
              className="text-neutral-400 hover:text-white text-2xl leading-none"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
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
  onToggleFavorite,
}: {
  entry: GenerationHistoryEntry;
  comfyConnected: boolean;
  onImageClick: (url: string) => void;
  onToggleFavorite?: (entryId: string) => void;
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
    <div className={`bg-neutral-800/50 border rounded-lg px-3 py-2 ${
      entry.isFavorite ? "border-amber-700/40" : "border-neutral-700/40"
    }`}>
      {/* ヘッダー行 */}
      <div className="flex items-center gap-2 text-[11px]">
        {/* Favorite toggle */}
        {onToggleFavorite && (
          <button
            onClick={() => onToggleFavorite(entry.id)}
            className={`transition-colors flex-shrink-0 ${
              entry.isFavorite
                ? "text-amber-400 hover:text-amber-300"
                : "text-neutral-700 hover:text-amber-400"
            }`}
            title={entry.isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            ★
          </button>
        )}
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
        {ov.width && ov.height && (
          <span className="text-neutral-500">
            <span className="text-neutral-300 font-mono">{ov.width}×{ov.height}</span>
          </span>
        )}
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
          {entry.imageUrls.map((url, i) => {
            const filename = url.split("filename=")[1]?.split("&")[0] ?? `image_${i}.png`;
            return (
              <div key={i} className="flex-shrink-0 relative group/img">
                <button
                  onClick={() => onImageClick(url)}
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
                {/* Download button overlay */}
                <button
                  onClick={() => downloadImage(url, filename)}
                  className="absolute bottom-1 right-1 bg-black/60 hover:bg-black/80 text-neutral-300 hover:text-white rounded px-1.5 py-0.5 text-[10px] opacity-0 group-hover/img:opacity-100 transition-opacity"
                  title={`Save as ${filename}`}
                >
                  ⬇
                </button>
              </div>
            );
          })}
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
            {ov.width && ov.height && (
              <>
                {" / "}size:{" "}
                <span className="text-neutral-300 font-mono">
                  {ov.width}×{ov.height}
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
