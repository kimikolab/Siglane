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
export async function translateTags(
  settings: LlmSettings,
  tagsJson: string,
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
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: `LLM request failed: ${message}` };
  }
}
