// ComfyUI API形式ワークフロー解析・送信ユーティリティ

import type { ComfyGenerationOverrides } from "@/types";

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

// サンプラー系ノードを探す（export for pinning overlap detection）
// positive/negative の入力がノード参照（[nodeId, slot]）であるノード
export function findSamplerNode(
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

// サンプラーノードのseedをランダム化する
// ComfyUIのUI上では control_after_generate で自動ランダム化されるが、
// API形式ではその仕組みがないため、送信前に手動でランダム化する
export function randomizeSeed(workflow: ComfyApiWorkflow): ComfyApiWorkflow {
  const wf = { ...workflow };
  for (const [nodeId, node] of Object.entries(wf)) {
    if (typeof node.inputs?.seed === "number") {
      wf[nodeId] = {
        ...node,
        inputs: {
          ...node.inputs,
          seed: Math.floor(Math.random() * 2 ** 32),
        },
      };
    }
  }
  return wf;
}

// --- オーバーライド ---

// API形式ワークフローからオーバーライド初期値を抽出
export function extractOverrides(
  workflow: ComfyApiWorkflow,
): ComfyGenerationOverrides {
  const sampler = findSamplerNode(workflow);
  const params = sampler ? extractApiSamplerParams(sampler.node) : {};
  const size = extractApiImageSize(workflow);
  return {
    seed: "random",
    cfg: params.cfg ?? 7.0,
    steps: params.steps ?? 20,
    samplerName: params.samplerName ?? "euler",
    scheduler: params.scheduler ?? "normal",
    denoise: params.denoise ?? 1.0,
    width: size.width,
    height: size.height,
  };
}

// オーバーライド値をワークフローのサンプラーノードに適用
export function applyOverrides(
  workflow: ComfyApiWorkflow,
  overrides: ComfyGenerationOverrides,
): ComfyApiWorkflow {
  const wf = JSON.parse(JSON.stringify(workflow)) as ComfyApiWorkflow;
  const sampler = findSamplerNode(wf);
  if (!sampler) return wf;

  const inputs = wf[sampler.nodeId].inputs;
  inputs.seed =
    overrides.seed === "random"
      ? Math.floor(Math.random() * 2 ** 32)
      : overrides.seed;
  inputs.cfg = overrides.cfg;
  inputs.steps = overrides.steps;
  inputs.sampler_name = overrides.samplerName;
  inputs.scheduler = overrides.scheduler;
  inputs.denoise = overrides.denoise;

  // EmptyLatentImageの解像度をオーバーライド
  if (overrides.width && overrides.height) {
    for (const [nodeId, node] of Object.entries(wf)) {
      if (node.class_type === "EmptyLatentImage") {
        wf[nodeId] = {
          ...node,
          inputs: { ...node.inputs, width: overrides.width, height: overrides.height },
        };
        break;
      }
    }
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

// --- ピン留め（Node Parameter Pinning） ---

import type { PinnedParameter } from "@/types";

// ピン留め候補となるパラメータ情報
export interface PinnableParam {
  paramName: string;
  value: unknown;
  type: "number" | "string" | "boolean";
  // /object_info から取得した制約
  min?: number;
  max?: number;
  step?: number;
}

export interface PinnableNode {
  nodeId: string;
  classType: string;
  title: string;       // _meta.title or classType
  params: PinnableParam[];
  // Siglaneが既にバインドしてるノードか
  isBound?: boolean;
}

// ワークフローからピン留め候補のノード＋パラメータを抽出
export function extractPinnableNodes(
  workflow: ComfyApiWorkflow,
  positiveNodeId?: string,
  negativeNodeId?: string,
): PinnableNode[] {
  const nodes: PinnableNode[] = [];

  for (const [nodeId, node] of Object.entries(workflow)) {
    const params: PinnableParam[] = [];

    for (const [paramName, value] of Object.entries(node.inputs)) {
      // ノード参照（接続）は除外
      if (isNodeRef(value)) continue;
      // null/undefinedは除外
      if (value === null || value === undefined) continue;

      const type = typeof value;
      if (type === "number") {
        params.push({ paramName, value, type: "number" });
      } else if (type === "string") {
        params.push({ paramName, value, type: "string" });
      } else if (type === "boolean") {
        params.push({ paramName, value, type: "boolean" });
      }
      // その他の型（object, array）は除外
    }

    if (params.length === 0) continue;

    const isBound = nodeId === positiveNodeId || nodeId === negativeNodeId;
    nodes.push({
      nodeId,
      classType: node.class_type,
      title: node._meta?.title ?? node.class_type,
      params,
      isBound,
    });
  }

  // バインド済みノードは後ろに、それ以外はノードIDの数値順
  return nodes.sort((a, b) => {
    if (a.isBound && !b.isBound) return 1;
    if (!a.isBound && b.isBound) return -1;
    return parseInt(a.nodeId) - parseInt(b.nodeId);
  });
}

// ComfyUIの /object_info からノードの入力定義を取得
export interface InputDef {
  paramName: string;
  type: string;
  min?: number;
  max?: number;
  step?: number;
  default?: unknown;
  isInteger?: boolean;
  // 選択肢型（sampler_name, scheduler等）
  options?: string[];
}

export async function fetchNodeInputDefs(
  connection: ComfyConnection,
  classType: string,
): Promise<InputDef[]> {
  try {
    const url = `${connection.url.replace(/\/+$/, "")}/object_info/${classType}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return [];

    const data = await response.json();
    const nodeInfo = data[classType];
    if (!nodeInfo?.input) return [];

    const defs: InputDef[] = [];
    // required と optional の両方を処理
    for (const section of ["required", "optional"]) {
      const inputs = nodeInfo.input[section];
      if (!inputs || typeof inputs !== "object") continue;

      for (const [paramName, spec] of Object.entries(inputs)) {
        if (!Array.isArray(spec) || spec.length === 0) continue;
        const typeName = spec[0];
        const opts = spec[1] as Record<string, unknown> | undefined;

        // 選択肢型: typeNameが配列の場合 → [["euler", "euler_ancestral", ...]]
        if (Array.isArray(typeName)) {
          const options = typeName.filter((v): v is string => typeof v === "string");
          if (options.length > 0) {
            defs.push({ paramName, type: "COMBO", options });
          }
        } else if (typeName === "INT" || typeName === "FLOAT") {
          defs.push({
            paramName,
            type: typeName,
            min: typeof opts?.min === "number" ? opts.min : undefined,
            max: typeof opts?.max === "number" ? opts.max : undefined,
            step: typeof opts?.step === "number" ? opts.step : (typeName === "INT" ? 1 : undefined),
            default: opts?.default,
            isInteger: typeName === "INT",
          });
        } else if (typeof typeName === "string") {
          defs.push({ paramName, type: typeName });
        }
      }
    }
    return defs;
  } catch {
    return [];
  }
}

// ピン留めされた値をワークフローに適用
export function applyPinnedParameters(
  workflow: ComfyApiWorkflow,
  pins: PinnedParameter[],
): ComfyApiWorkflow {
  const wf = JSON.parse(JSON.stringify(workflow)) as ComfyApiWorkflow;

  for (const pin of pins) {
    const node = wf[pin.nodeId];
    if (!node) continue;
    // seed="random"の場合はランダム整数を生成
    if (pin.paramName === "seed" && pin.value === "random") {
      node.inputs[pin.paramName] = Math.floor(Math.random() * 2 ** 32);
    } else {
      node.inputs[pin.paramName] = pin.value;
    }
  }

  return wf;
}

// --- LoadImage画像アップロード ---

export interface UploadImageResult {
  success: boolean;
  filename?: string;  // ComfyUI上のファイル名
  error?: string;
}

// ComfyUIの /upload/image に画像をアップロード
export async function uploadImageToComfy(
  connection: ComfyConnection,
  file: File,
): Promise<UploadImageResult> {
  try {
    const url = `${connection.url.replace(/\/+$/, "")}/upload/image`;
    const formData = new FormData();
    formData.append("image", file);

    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `Upload failed: ${response.status} ${text.slice(0, 200)}` };
    }

    const data = await response.json();
    // ComfyUIは { name: "filename.png", subfolder: "", type: "input" } を返す
    const filename = data.name;
    if (!filename) {
      return { success: false, error: "Upload succeeded but no filename returned" };
    }
    return { success: true, filename };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: `Upload failed: ${message}` };
  }
}
