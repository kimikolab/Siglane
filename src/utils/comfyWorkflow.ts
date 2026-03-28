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

export interface ComfyParseResult {
  positiveNodeId: number;
  negativeNodeId: number;
  positivePrompt: string;
  negativePrompt: string;
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
