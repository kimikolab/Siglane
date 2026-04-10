// ComfyUI 生成完了検知ユーティリティ
// /history/{promptId} をポーリングして完了を検出する
// WebSocketのイベント形式がComfyUIバージョンによって異なるため、
// より安定したポーリング方式を採用

import type { ComfyConnection } from "./comfyApi";

export interface ComfyExecutionResult {
  promptId: string;
  imageUrls: string[];
}

// ComfyUIの /history/{promptId} から生成画像のURLを取得
// 未完了の場合はnullを返す
async function fetchHistoryImages(
  connection: ComfyConnection,
  promptId: string,
): Promise<string[] | null> {
  const baseUrl = connection.url.replace(/\/+$/, "");
  try {
    const resp = await fetch(`${baseUrl}/history/${promptId}`);
    if (!resp.ok) return null;
    const data = await resp.json();

    const entry = data[promptId];
    if (!entry?.outputs) return null; // まだ完了していない

    const urls: string[] = [];
    for (const nodeOutput of Object.values(entry.outputs) as Array<Record<string, unknown>>) {
      const images = nodeOutput.images as
        | Array<{ filename: string; subfolder?: string; type?: string }>
        | undefined;
      if (!images) continue;
      for (const img of images) {
        const params = new URLSearchParams({
          filename: img.filename,
          subfolder: img.subfolder ?? "",
          type: img.type ?? "output",
        });
        urls.push(`${baseUrl}/view?${params.toString()}`);
      }
    }
    return urls;
  } catch {
    return null;
  }
}

// /history/{promptId} をポーリングして生成完了を待つ
// 完了時にcallbackを呼ぶ
export function watchExecution(
  connection: ComfyConnection,
  promptId: string,
  onComplete: (result: ComfyExecutionResult) => void,
  onError?: (error: string) => void,
): () => void {
  let cancelled = false;
  const POLL_INTERVAL = 2000; // 2秒ごと
  const MAX_WAIT = 300000;    // 5分タイムアウト
  const startTime = Date.now();

  const poll = async () => {
    if (cancelled) return;

    if (Date.now() - startTime > MAX_WAIT) {
      onError?.("Generation timed out (5 min)");
      return;
    }

    const imageUrls = await fetchHistoryImages(connection, promptId);

    if (cancelled) return;

    if (imageUrls !== null) {
      // 完了
      onComplete({ promptId, imageUrls });
      return;
    }

    // まだ完了していない → 再ポーリング
    setTimeout(poll, POLL_INTERVAL);
  };

  // 最初のポーリングは3秒後（生成開始直後はまだ結果がないため）
  const initialTimer = setTimeout(poll, 3000);

  // クリーンアップ関数
  return () => {
    cancelled = true;
    clearTimeout(initialTimer);
  };
}
