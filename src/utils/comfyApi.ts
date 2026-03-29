// ComfyUI API形式ワークフロー解析・送信ユーティリティ

// --- 型定義 ---

// API形式のノード
interface ComfyApiNode {
  class_type: string;
  inputs: Record<string, unknown>;
  _meta?: { title?: string };
}

// API形式ワークフロー全体
export type ComfyApiWorkflow = Record<string, ComfyApiNode>;

// ノード参照: [node_id_string, output_slot_index]
type NodeRef = [string, number];

function isNodeRef(value: unknown): value is NodeRef {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "string" &&
    typeof value[1] === "number"
  );
}

// 解析結果
export interface ComfyApiParseResult {
  positiveNodeId: string;
  negativeNodeId: string;
  positivePrompt: string;
  negativePrompt: string;
  generationParams: ComfyApiGenerationParams;
}

export interface ComfyApiGenerationParams {
  seed?: number;
  steps?: number;
  cfg?: number;
  samplerName?: string;
  scheduler?: string;
  denoise?: number;
  modelName?: string;
  width?: number;
  height?: number;
}

// 接続設定
export interface ComfyConnection {
  id: string;
  label: string;
  url: string;
}

export interface ComfySettings {
  connections: ComfyConnection[];
  activeConnectionId: string;
}

// --- デフォルト設定 ---

const DEFAULT_URL = "http://127.0.0.1:8188";
const SETTINGS_STORAGE_KEY = "siglane-comfy-settings";

export function createDefaultSettings(): ComfySettings {
  const id = crypto.randomUUID();
  return {
    connections: [{ id, label: "Local ComfyUI", url: DEFAULT_URL }],
    activeConnectionId: id,
  };
}

export function loadComfySettings(): ComfySettings {
  if (typeof window === "undefined") return createDefaultSettings();
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return createDefaultSettings();
    return JSON.parse(raw) as ComfySettings;
  } catch {
    return createDefaultSettings();
  }
}

export function saveComfySettings(settings: ComfySettings): void {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

export function getActiveConnection(
  settings: ComfySettings,
): ComfyConnection | null {
  return (
    settings.connections.find((c) => c.id === settings.activeConnectionId) ??
    settings.connections[0] ??
    null
  );
}

// --- API形式判定 ---

// API形式かどうかを判定する
// API形式: キーが文字列のノードID、値が {class_type, inputs} のオブジェクト
// UI形式: {nodes: [...], links: [...]}
export function isApiFormat(json: unknown): boolean {
  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    return false;
  }
  const obj = json as Record<string, unknown>;
  // UI形式の特徴: nodes と links がある
  if ("nodes" in obj && "links" in obj) return false;
  // API形式の特徴: 各値が class_type を持つ
  const values = Object.values(obj);
  if (values.length === 0) return false;
  return values.some(
    (v) =>
      typeof v === "object" &&
      v !== null &&
      "class_type" in (v as Record<string, unknown>),
  );
}

// --- 解析 ---

// サンプラー系ノードを探す
// positive/negative の入力がノード参照（[nodeId, slot]）であるノード
function findSamplerNode(
  workflow: ComfyApiWorkflow,
): { nodeId: string; node: ComfyApiNode } | null {
  for (const [nodeId, node] of Object.entries(workflow)) {
    const inputs = node.inputs;
    if (
      inputs &&
      isNodeRef(inputs.positive) &&
      isNodeRef(inputs.negative)
    ) {
      return { nodeId, node };
    }
  }
  return null;
}

// KSampler系ノードから生成パラメータを抽出
function extractApiSamplerParams(
  node: ComfyApiNode,
): Partial<ComfyApiGenerationParams> {
  const i = node.inputs;
  return {
    seed: typeof i.seed === "number" ? i.seed : undefined,
    steps: typeof i.steps === "number" ? i.steps : undefined,
    cfg: typeof i.cfg === "number" ? i.cfg : undefined,
    samplerName: typeof i.sampler_name === "string" ? i.sampler_name : undefined,
    scheduler: typeof i.scheduler === "string" ? i.scheduler : undefined,
    denoise: typeof i.denoise === "number" ? i.denoise : undefined,
  };
}

// CheckpointLoaderSimpleからモデル名を取得
function extractApiModelName(workflow: ComfyApiWorkflow): string | undefined {
  for (const node of Object.values(workflow)) {
    if (
      node.class_type === "CheckpointLoaderSimple" ||
      node.class_type === "CheckpointLoader"
    ) {
      const name = node.inputs.ckpt_name;
      return typeof name === "string" ? name : undefined;
    }
  }
  return undefined;
}

// EmptyLatentImageから画像サイズを取得
function extractApiImageSize(
  workflow: ComfyApiWorkflow,
): { width?: number; height?: number } {
  for (const node of Object.values(workflow)) {
    if (node.class_type === "EmptyLatentImage") {
      return {
        width:
          typeof node.inputs.width === "number"
            ? node.inputs.width
            : undefined,
        height:
          typeof node.inputs.height === "number"
            ? node.inputs.height
            : undefined,
      };
    }
  }
  return {};
}

// 生成パラメータをメモ用テキストに変換
export function formatApiGenerationParams(
  params: ComfyApiGenerationParams,
): string {
  const parts: string[] = [];
  if (params.modelName) parts.push(`model: ${params.modelName}`);
  if (params.seed !== undefined) parts.push(`seed: ${params.seed}`);
  if (params.steps !== undefined) parts.push(`steps: ${params.steps}`);
  if (params.cfg !== undefined) parts.push(`cfg: ${params.cfg}`);
  if (params.samplerName) parts.push(`sampler: ${params.samplerName}`);
  if (params.scheduler) parts.push(`scheduler: ${params.scheduler}`);
  if (params.width && params.height)
    parts.push(`size: ${params.width}x${params.height}`);
  if (params.denoise !== undefined && params.denoise !== 1)
    parts.push(`denoise: ${params.denoise}`);
  return parts.join(" / ");
}

// API形式ワークフローを解析
export function parseComfyApiWorkflow(
  json: unknown,
): ComfyApiParseResult | { error: string } {
  const workflow = json as ComfyApiWorkflow;

  const sampler = findSamplerNode(workflow);
  if (!sampler) {
    return {
      error: "No sampler node found (needs positive/negative inputs)",
    };
  }

  const posRef = sampler.node.inputs.positive as NodeRef;
  const negRef = sampler.node.inputs.negative as NodeRef;

  const posNodeId = posRef[0];
  const negNodeId = negRef[0];

  const posNode = workflow[posNodeId];
  const negNode = workflow[negNodeId];

  if (!posNode || !negNode) {
    return { error: "Could not find CLIPTextEncode nodes" };
  }

  const posPrompt =
    typeof posNode.inputs.text === "string" ? posNode.inputs.text : "";
  const negPrompt =
    typeof negNode.inputs.text === "string" ? negNode.inputs.text : "";

  return {
    positiveNodeId: posNodeId,
    negativeNodeId: negNodeId,
    positivePrompt: posPrompt,
    negativePrompt: negPrompt,
    generationParams: {
      ...extractApiSamplerParams(sampler.node),
      ...extractApiImageSize(workflow),
      modelName: extractApiModelName(workflow),
    },
  };
}

// 結果がエラーかどうか判定するヘルパー
export function isApiParseError(
  result: ComfyApiParseResult | { error: string },
): result is { error: string } {
  return "error" in result;
}

// --- 書き戻し ---

// API形式ワークフローのプロンプトを書き換えて新しいオブジェクトを返す
export function writePromptsToApiWorkflow(
  workflow: unknown,
  positiveNodeId: string,
  negativeNodeId: string,
  positivePrompt: string,
  negativePrompt: string,
): ComfyApiWorkflow {
  const wf = JSON.parse(JSON.stringify(workflow)) as ComfyApiWorkflow;

  if (wf[positiveNodeId]) {
    wf[positiveNodeId].inputs.text = positivePrompt;
  }
  if (wf[negativeNodeId]) {
    wf[negativeNodeId].inputs.text = negativePrompt;
  }

  return wf;
}

// --- API送信 ---

export interface QueueResult {
  success: boolean;
  promptId?: string;
  error?: string;
}

// ComfyUIにプロンプトを送信してキューに追加
export async function queuePrompt(
  connection: ComfyConnection,
  workflow: ComfyApiWorkflow,
): Promise<QueueResult> {
  const url = `${connection.url.replace(/\/+$/, "")}/prompt`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: workflow }),
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        success: false,
        error: `ComfyUI returned ${response.status}: ${text.slice(0, 200)}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      promptId: data.prompt_id,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error";
    return {
      success: false,
      error: `Connection failed: ${message}`,
    };
  }
}

// 接続テスト（ComfyUIが起動しているか確認）
export async function testConnection(
  connection: ComfyConnection,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const url = `${connection.url.replace(/\/+$/, "")}/system_stats`;
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}` };
    }
    return { ok: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Connection refused";
    return { ok: false, error: message };
  }
}
