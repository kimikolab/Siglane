// ComfyUI ワークフローJSON解析・書き戻しユーティリティ

// --- 型定義 ---

interface ComfyInput {
  name: string;
  type: string;
  link: number | null;
}

interface ComfyOutput {
  name: string;
  type: string;
  links: number[] | null;
}

interface ComfyNode {
  id: number;
  type: string;
  inputs?: ComfyInput[];
  outputs?: ComfyOutput[];
  widgets_values?: unknown[];
}

// link: [link_id, src_node_id, src_slot, dst_node_id, dst_slot, type]
type ComfyLink = [number, number, number, number, number, string];

interface ComfyWorkflow {
  nodes: ComfyNode[];
  links: ComfyLink[];
  [key: string]: unknown;
}

export interface ComfyGenerationParams {
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

export interface ComfyParseResult {
  positiveNodeId: number;
  negativeNodeId: number;
  positivePrompt: string;
  negativePrompt: string;
  generationParams: ComfyGenerationParams;
}

// --- 解析 ---

// positive/negative CONDITIONING入力を持つサンプラーノードを探す
function findSamplerNode(workflow: ComfyWorkflow): ComfyNode | null {
  return (
    workflow.nodes.find(
      (node) =>
        node.inputs &&
        node.inputs.some(
          (i) => i.name === "positive" && i.type === "CONDITIONING",
        ) &&
        node.inputs.some(
          (i) => i.name === "negative" && i.type === "CONDITIONING",
        ),
    ) ?? null
  );
}

// KSampler系ノードから生成パラメータを抽出
// widgets_values: [seed, control_after_generate, steps, cfg, sampler_name, scheduler, denoise]
function extractSamplerParams(node: ComfyNode): Partial<ComfyGenerationParams> {
  const v = node.widgets_values;
  if (!v || v.length < 7) return {};
  return {
    seed: typeof v[0] === "number" ? v[0] : undefined,
    steps: typeof v[2] === "number" ? v[2] : undefined,
    cfg: typeof v[3] === "number" ? v[3] : undefined,
    samplerName: typeof v[4] === "string" ? v[4] : undefined,
    scheduler: typeof v[5] === "string" ? v[5] : undefined,
    denoise: typeof v[6] === "number" ? v[6] : undefined,
  };
}

// CheckpointLoaderSimpleからモデル名を抽出
function extractModelName(workflow: ComfyWorkflow): string | undefined {
  const loader = workflow.nodes.find(
    (n) => n.type === "CheckpointLoaderSimple" || n.type === "CheckpointLoader",
  );
  if (!loader?.widgets_values?.[0]) return undefined;
  return String(loader.widgets_values[0]);
}

// EmptyLatentImageから画像サイズを抽出
function extractImageSize(workflow: ComfyWorkflow): { width?: number; height?: number } {
  const node = workflow.nodes.find((n) => n.type === "EmptyLatentImage");
  if (!node?.widgets_values || node.widgets_values.length < 2) return {};
  return {
    width: typeof node.widgets_values[0] === "number" ? node.widgets_values[0] : undefined,
    height: typeof node.widgets_values[1] === "number" ? node.widgets_values[1] : undefined,
  };
}

// 生成パラメータをメモ用テキストに変換
export function formatGenerationParams(params: ComfyGenerationParams): string {
  const parts: string[] = [];
  if (params.modelName) parts.push(`model: ${params.modelName}`);
  if (params.seed !== undefined) parts.push(`seed: ${params.seed}`);
  if (params.steps !== undefined) parts.push(`steps: ${params.steps}`);
  if (params.cfg !== undefined) parts.push(`cfg: ${params.cfg}`);
  if (params.samplerName) parts.push(`sampler: ${params.samplerName}`);
  if (params.scheduler) parts.push(`scheduler: ${params.scheduler}`);
  if (params.width && params.height) parts.push(`size: ${params.width}x${params.height}`);
  if (params.denoise !== undefined && params.denoise !== 1) parts.push(`denoise: ${params.denoise}`);
  return parts.join(" / ");
}

// link_idからソースノードIDを取得
function getSourceNodeId(
  workflow: ComfyWorkflow,
  linkId: number,
): number | null {
  const link = workflow.links.find((l) => l[0] === linkId);
  return link ? link[1] : null;
}

// ノードIDからCLIPTextEncodeのプロンプトテキストを取得
function getPromptText(workflow: ComfyWorkflow, nodeId: number): string {
  const node = workflow.nodes.find((n) => n.id === nodeId);
  if (!node || !node.widgets_values || node.widgets_values.length === 0) {
    return "";
  }
  return String(node.widgets_values[0] ?? "");
}

// ワークフローJSONからP/Nプロンプトを抽出
export function parseComfyWorkflow(
  json: unknown,
): ComfyParseResult | { error: string } {
  const workflow = json as ComfyWorkflow;

  if (!workflow.nodes || !workflow.links) {
    return { error: "Invalid workflow: nodes or links missing" };
  }

  const sampler = findSamplerNode(workflow);
  if (!sampler || !sampler.inputs) {
    return {
      error:
        "No sampler node found (needs positive/negative CONDITIONING inputs)",
    };
  }

  const posInput = sampler.inputs.find((i) => i.name === "positive");
  const negInput = sampler.inputs.find((i) => i.name === "negative");

  if (!posInput?.link || !negInput?.link) {
    return { error: "Sampler positive/negative inputs are not connected" };
  }

  const posNodeId = getSourceNodeId(workflow, posInput.link);
  const negNodeId = getSourceNodeId(workflow, negInput.link);

  if (posNodeId === null || negNodeId === null) {
    return { error: "Could not trace links to CLIPTextEncode nodes" };
  }

  return {
    positiveNodeId: posNodeId,
    negativeNodeId: negNodeId,
    positivePrompt: getPromptText(workflow, posNodeId),
    negativePrompt: getPromptText(workflow, negNodeId),
    generationParams: {
      ...extractSamplerParams(sampler),
      ...extractImageSize(workflow),
      modelName: extractModelName(workflow),
    },
  };
}

// --- エクスポート ---

// ワークフローJSONのプロンプトを書き換えて新しいオブジェクトを返す
export function writePromptsToWorkflow(
  workflow: unknown,
  positiveNodeId: number,
  negativeNodeId: number,
  positivePrompt: string,
  negativePrompt: string,
): unknown {
  // deep clone
  const wf = JSON.parse(JSON.stringify(workflow)) as ComfyWorkflow;

  for (const node of wf.nodes) {
    if (node.id === positiveNodeId && node.widgets_values) {
      node.widgets_values[0] = positivePrompt;
    }
    if (node.id === negativeNodeId && node.widgets_values) {
      node.widgets_values[0] = negativePrompt;
    }
  }

  return wf;
}

// 結果がエラーかどうか判定するヘルパー
export function isParseError(
  result: ComfyParseResult | { error: string },
): result is { error: string } {
  return "error" in result;
}
