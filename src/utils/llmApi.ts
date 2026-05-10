// LLM API接続・翻訳ユーティリティ
// OpenAI互換エンドポイント（Ollama, LM Studio, OpenAI等）に対応

const SETTINGS_STORAGE_KEY = "siglane-llm-settings";

export interface LlmConnection {
  url: string;        // e.g. http://localhost:11434/v1/chat/completions
  apiKey: string;     // 空文字ならヘッダー省略（Ollama等）
  model: string;      // e.g. gemma2, llama3, gpt-4o-mini
}

export interface LlmSettings {
  connection: LlmConnection;
  systemPrompt: string;
}

export const DEFAULT_SYSTEM_PROMPT = `You are a prompt tag expert for AI image generation (Stable Diffusion, NovelAI, etc.).

For each tag in the JSON array, fill in:
- "description": A brief explanation in Japanese (what this tag does in image generation)
- "group": One category from this list: Quality, Character, Hair, Eyes, Expression, Clothing, Accessories, Background, Pose, Style
- "negative": Set to true ONLY if this tag is typically used in negative prompts

Respond with ONLY the JSON array, no markdown fences, no extra text.`;

export function createDefaultLlmSettings(): LlmSettings {
  return {
    connection: {
      url: "http://localhost:11434/v1/chat/completions",
      apiKey: "",
      model: "gemma2",
    },
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
  };
}

export function loadLlmSettings(): LlmSettings {
  if (typeof window === "undefined") return createDefaultLlmSettings();
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return createDefaultLlmSettings();
    const parsed = JSON.parse(raw) as LlmSettings;
    // systemPromptが未設定の場合はデフォルトを使う
    if (!parsed.systemPrompt) {
      parsed.systemPrompt = DEFAULT_SYSTEM_PROMPT;
    }
    return parsed;
  } catch {
    return createDefaultLlmSettings();
  }
}

export function saveLlmSettings(settings: LlmSettings): void {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

// OllamaベースURLを接続URLから推定
function deriveOllamaBaseUrl(connectionUrl: string): string {
  try {
    const u = new URL(connectionUrl);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "http://localhost:11434";
  }
}

// Ollamaのモデル一覧を取得
export async function fetchOllamaModels(
  connectionUrl: string,
): Promise<{ ok: true; models: string[] } | { ok: false; error: string }> {
  const base = deriveOllamaBaseUrl(connectionUrl);
  try {
    const resp = await fetch(`${base}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) {
      return { ok: false, error: `HTTP ${resp.status}` };
    }
    const data = await resp.json();
    const models: string[] = (data.models ?? []).map(
      (m: { name?: string }) => m.name ?? "",
    ).filter(Boolean);
    return { ok: true, models };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection refused";
    return { ok: false, error: message };
  }
}

// 接続テスト（モデル一覧を取得してみる）
export async function testLlmConnection(
  connection: LlmConnection,
): Promise<{ ok: boolean; error?: string }> {
  // /v1/chat/completions → /v1/models に変換してテスト
  const modelsUrl = connection.url.replace(/\/chat\/completions\/?$/, "/models");
  try {
    const headers: Record<string, string> = {};
    if (connection.apiKey) {
      headers["Authorization"] = `Bearer ${connection.apiKey}`;
    }
    const resp = await fetch(modelsUrl, {
      headers,
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) {
      return { ok: false, error: `HTTP ${resp.status}` };
    }
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection refused";
    return { ok: false, error: message };
  }
}

// LLMにタグリストを送信して注釈・グループ・ネガティブ情報を取得
// 内部用：1バッチ分のタグを処理する
async function translateTagsBatch(
  settings: LlmSettings,
  tagsJson: string,
  signal?: AbortSignal,
): Promise<{ ok: true; result: string } | { ok: false; error: string }> {
  const { connection, systemPrompt } = settings;

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (connection.apiKey) {
      headers["Authorization"] = `Bearer ${connection.apiKey}`;
    }

    const body = {
      model: connection.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: tagsJson },
      ],
      temperature: 0.3,
    };

    const resp = await fetch(connection.url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal,
    });

    if (!resp.ok) {
      const text = await resp.text();
      return {
        ok: false,
        error: `LLM returned ${resp.status}: ${text.slice(0, 200)}`,
      };
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return { ok: false, error: "No response content from LLM" };
    }

    // ```json ... ``` が含まれる場合はフェンスを除去
    const cleaned = content
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();

    return { ok: true, result: cleaned };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, error: "Cancelled" };
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: `LLM request failed: ${message}` };
  }
}

// バッチサイズと1タグあたりのタイムアウト（ms）
const BATCH_SIZE = 10;
const TIMEOUT_MS_PER_TAG = 60_000;

export interface TranslateProgress {
  done: number;
  total: number;
  batchIndex: number;
  batchCount: number;
}

// LLMにタグリストを送信。大量タグはバッチ分割して順次処理。
// signal: 外部からのキャンセル用
// onProgress: バッチ完了ごとに呼ばれる進捗コールバック
// 戻り値の warning: 部分失敗時に何件失敗したかを伝える
export async function translateTags(
  settings: LlmSettings,
  tagsJson: string,
  options?: {
    signal?: AbortSignal;
    onProgress?: (progress: TranslateProgress) => void;
  },
): Promise<
  | { ok: true; result: string; warning?: string }
  | { ok: false; error: string }
> {
  // 入力JSONをパース
  let entries: unknown[];
  try {
    const parsed = JSON.parse(tagsJson);
    if (!Array.isArray(parsed)) {
      return { ok: false, error: "Input is not a JSON array" };
    }
    entries = parsed;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Parse error";
    return { ok: false, error: `Invalid JSON input: ${message}` };
  }

  if (entries.length === 0) {
    return { ok: true, result: tagsJson };
  }

  // バッチ分割
  const batches: unknown[][] = [];
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    batches.push(entries.slice(i, i + BATCH_SIZE));
  }

  const externalSignal = options?.signal;
  const onProgress = options?.onProgress;
  const results: unknown[] = [];
  const failedBatches: number[] = [];
  let lastError: string | null = null;

  onProgress?.({
    done: 0,
    total: entries.length,
    batchIndex: 0,
    batchCount: batches.length,
  });

  for (let bi = 0; bi < batches.length; bi++) {
    if (externalSignal?.aborted) {
      return { ok: false, error: "Cancelled" };
    }

    const batch = batches[bi];
    // バッチサイズに応じたタイムアウト + 外部シグナルを合成
    const timeoutMs = TIMEOUT_MS_PER_TAG * batch.length;
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

    const onExternalAbort = () => timeoutController.abort();
    externalSignal?.addEventListener("abort", onExternalAbort);

    const batchResult = await translateTagsBatch(
      settings,
      JSON.stringify(batch, null, 2),
      timeoutController.signal,
    );

    clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", onExternalAbort);

    if (externalSignal?.aborted) {
      return { ok: false, error: "Cancelled" };
    }

    if (batchResult.ok) {
      try {
        const parsed = JSON.parse(batchResult.result);
        if (Array.isArray(parsed)) {
          results.push(...parsed);
        } else {
          failedBatches.push(bi);
          results.push(...batch);
          lastError = `Batch ${bi + 1}: response was not an array`;
        }
      } catch {
        failedBatches.push(bi);
        results.push(...batch);
        lastError = `Batch ${bi + 1}: failed to parse response`;
      }
    } else {
      failedBatches.push(bi);
      results.push(...batch);
      lastError = `Batch ${bi + 1}: ${batchResult.error}`;
    }

    onProgress?.({
      done: Math.min((bi + 1) * BATCH_SIZE, entries.length),
      total: entries.length,
      batchIndex: bi + 1,
      batchCount: batches.length,
    });
  }

  const merged = JSON.stringify(results, null, 2);

  if (failedBatches.length === batches.length) {
    return {
      ok: false,
      error: lastError ?? "All batches failed",
    };
  }

  if (failedBatches.length > 0) {
    return {
      ok: true,
      result: merged,
      warning: `${failedBatches.length}/${batches.length} batches failed (${lastError ?? "unknown error"}). Failed entries kept as-is.`,
    };
  }

  return { ok: true, result: merged };
}
