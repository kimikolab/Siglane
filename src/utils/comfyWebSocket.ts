// ComfyUI WebSocket接続ユーティリティ
// 生成完了を検知して画像URLを取得する

import type { ComfyConnection } from "./comfyApi";

export interface ComfyExecutionResult {
  promptId: string;
  imageUrls: string[];
}

// ComfyUIの /history/{promptId} から生成画像のURLを取得
export async function fetchHistoryImages(
  connection: ComfyConnection,
  promptId: string,
): Promise<string[]> {
  const baseUrl = connection.url.replace(/\/+$/, "");
  try {
    const resp = await fetch(`${baseUrl}/history/${promptId}`);
    if (!resp.ok) return [];
    const data = await resp.json();

    const entry = data[promptId];
    if (!entry?.outputs) return [];

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
    return [];
  }
}

// WebSocket接続してpromptIdの実行完了を監視
// 完了時にcallbackを呼ぶ
export function watchExecution(
  connection: ComfyConnection,
  promptId: string,
  onComplete: (result: ComfyExecutionResult) => void,
  onError?: (error: string) => void,
): () => void {
  const wsUrl = connection.url
    .replace(/\/+$/, "")
    .replace(/^http/, "ws") + "/ws";

  let ws: WebSocket | null = null;
  let closed = false;

  try {
    ws = new WebSocket(wsUrl);
  } catch (err) {
    onError?.(`WebSocket connection failed: ${err}`);
    return () => {};
  }

  ws.onmessage = async (event) => {
    // バイナリメッセージ（プレビュー画像等）はスキップ
    if (typeof event.data !== "string") return;

    try {
      const msg = JSON.parse(event.data);

      // ComfyUIの完了シグナル:
      // { type: "executing", data: { node: null, prompt_id: "..." } }
      // node が null = 全ノード実行完了
      if (
        msg.type === "executing" &&
        msg.data?.prompt_id === promptId &&
        msg.data?.node === null
      ) {
        // historyに書き込まれるまで少し待つ
        setTimeout(async () => {
          if (closed) return;
          const imageUrls = await fetchHistoryImages(connection, promptId);
          onComplete({ promptId, imageUrls });
          ws?.close();
          closed = true;
        }, 1000);
      }
    } catch {
      // JSONパース失敗は無視
    }
  };

  ws.onerror = () => {
    if (!closed) {
      onError?.("WebSocket connection error");
    }
  };

  // 120秒タイムアウト（重い生成に対応）
  const timeout = setTimeout(() => {
    if (!closed) {
      closed = true;
      ws?.close();
      onError?.("Generation timed out (120s)");
    }
  }, 120000);

  // クリーンアップ関数
  return () => {
    closed = true;
    clearTimeout(timeout);
    ws?.close();
  };
}
