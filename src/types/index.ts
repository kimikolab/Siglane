// 1行のプロンプト要素
// WPFでいうと、ItemsControlの1アイテムに相当するモデル
export interface PromptLine {
  id: string;
  text: string;
  enabled: boolean;
}

// 1セッション（旧SiglaneState + メタ情報）
export interface Session {
  id: string;
  label: string;
  isTemplate: boolean;
  positiveLines: PromptLine[];
  negativeLines: PromptLine[];
  memo: string;
  updatedAt: string;
  folderId: string | null;
  // ComfyUI連携 - UI形式（オプショナル）
  comfyWorkflow?: unknown;
  comfyPositiveNodeId?: number;
  comfyNegativeNodeId?: number;
  // ComfyUI連携 - API形式（生成用）
  comfyApiWorkflow?: Record<string, unknown>;
  comfyApiPositiveNodeId?: string;
  comfyApiNegativeNodeId?: string;
}

// フォルダ（2階層まで: root → subfolder）
export interface Folder {
  id: string;
  label: string;
  parentId: string | null;
  order: number;
}

// アプリ全体の状態
export interface AppState {
  sessions: Session[];
  folders: Folder[];
  activeSessionId: string;
}

// 旧SiglaneState（マイグレーション用）
export interface SiglaneState {
  positiveLines: PromptLine[];
  negativeLines: PromptLine[];
  memo: string;
}

// --- ファクトリ関数 ---

// PromptLineを新規作成するヘルパー関数
export function createPromptLine(text: string): PromptLine {
  return {
    id: crypto.randomUUID(),
    text: text.trim(),
    enabled: true,
  };
}

// 空のセッションを作成
export function createSession(label: string, folderId: string | null = null): Session {
  return {
    id: crypto.randomUUID(),
    label,
    isTemplate: false,
    positiveLines: [],
    negativeLines: [],
    memo: "",
    updatedAt: new Date().toISOString(),
    folderId,
  };
}

// フォルダを作成
export function createFolder(
  label: string,
  parentId: string | null = null,
  order: number = 0,
): Folder {
  return {
    id: crypto.randomUUID(),
    label,
    parentId,
    order,
  };
}

// 2階層制約チェック: parentIdが既にサブフォルダならfalse
export function canCreateSubfolder(
  parentId: string,
  folders: Folder[],
): boolean {
  const parent = folders.find((f) => f.id === parentId);
  if (!parent) return false;
  return parent.parentId === null;
}

// セッションを複製（新しいid、全行も新しいidを振り直す）
export function duplicateSession(
  source: Session,
  newLabel: string,
): Session {
  return {
    id: crypto.randomUUID(),
    label: newLabel,
    isTemplate: false,
    positiveLines: source.positiveLines.map((l) => ({
      ...l,
      id: crypto.randomUUID(),
    })),
    negativeLines: source.negativeLines.map((l) => ({
      ...l,
      id: crypto.randomUUID(),
    })),
    memo: source.memo,
    updatedAt: new Date().toISOString(),
    folderId: source.folderId,
  };
}

// テンプレートから複製する際の自動命名
// 既存セッション名をスキャンして "テンプレート名 (N)" の空き番号を返す
export function generateCopyLabel(
  baseName: string,
  existingLabels: string[],
): string {
  let n = 1;
  let candidate = `${baseName} (${n})`;
  while (existingLabels.includes(candidate)) {
    n++;
    candidate = `${baseName} (${n})`;
  }
  return candidate;
}

// --- 重みユーティリティ ---

// テキストから重み値を抽出
// (tag:1.2) → 1.2, tag → 1.0, ((tag)) → 1.0
const WEIGHT_PATTERN = /^\((.+):(\d+\.?\d*)\)$/;

export function extractWeight(text: string): number {
  const match = text.match(WEIGHT_PATTERN);
  return match ? parseFloat(match[2]) : 1.0;
}

// テキスト内の重みを新しい値に設定
export function setWeight(text: string, weight: number): string {
  const rounded = Math.round(weight * 100) / 100;
  const match = text.match(WEIGHT_PATTERN);

  if (match) {
    const content = match[1];
    // 1.0に戻す場合は括弧を外す
    if (rounded === 1.0) return content;
    return `(${content}:${rounded})`;
  }

  // 括弧なしテキスト
  if (rounded === 1.0) return text;
  return `(${text}:${rounded})`;
}

// 特殊な重み記法を使っているか判定
// 多重括弧 ((tag)), 数値なし括弧 (tag), 角括弧 [tag] [tag:0.8] など
// これらはスライダーで操作すると壊れるため、対象外にする
export function hasSpecialWeightSyntax(text: string): boolean {
  const t = text.trim();
  // 多重括弧: ((tag)) or more
  if (/^\(\(.+\)\)$/.test(t)) return true;
  // 数値なし単一括弧: (tag) — SD1.5の1.1倍記法
  // ただし (tag:1.2) は通常記法なので除外
  if (/^\([^()]+\)$/.test(t) && !WEIGHT_PATTERN.test(t)) return true;
  // 角括弧: [tag] or [tag:0.8]
  if (/^\[.+\]$/.test(t)) return true;
  return false;
}

// 特殊記法の実効重みを計算
// (tag) = 1.1, ((tag)) = 1.21, [tag] = 0.91, [tag:0.8] = 0.8
export function calcSpecialWeight(text: string): number | null {
  const t = text.trim();

  // 多重丸括弧: 外側から括弧の深さを数える
  if (/^\(+[^()]+\)+$/.test(t)) {
    let depth = 0;
    for (const ch of t) {
      if (ch === "(") depth++;
      else break;
    }
    return Math.round(Math.pow(1.1, depth) * 100) / 100;
  }

  // 丸括弧（中にカンマなど含む）: (indoors, night) → 1.1
  if (/^\([^()]+\)$/.test(t) && !WEIGHT_PATTERN.test(t)) {
    return 1.1;
  }

  // 角括弧 + 明示的数値: [tag:0.8]
  const bracketWeight = t.match(/^\[.+:(\d+\.?\d*)\]$/);
  if (bracketWeight) {
    return parseFloat(bracketWeight[1]);
  }

  // 角括弧のみ: [tag] → 1/1.1
  if (/^\[[^\]]+\]$/.test(t)) {
    return Math.round((1 / 1.1) * 100) / 100;
  }

  return null;
}

// 重みをdelta分だけ増減
export function adjustWeight(text: string, delta: number): string {
  const current = extractWeight(text);
  const newWeight = Math.max(0, Math.min(2.0, current + delta));
  return setWeight(text, newWeight);
}

// --- パーサー ---

// カンマ区切りテキストをPromptLine[]に変換するパーサー
// 括弧 () [] <> の中のカンマでは分割しない
export function parsePrompt(raw: string): PromptLine[] {
  if (!raw.trim()) return [];

  const results: string[] = [];
  let current = "";
  let depth = 0;

  for (const ch of raw) {
    if (ch === "(" || ch === "[" || ch === "<") {
      depth++;
      current += ch;
    } else if (ch === ")" || ch === "]" || ch === ">") {
      depth = Math.max(0, depth - 1);
      current += ch;
    } else if (ch === "," && depth === 0) {
      results.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  results.push(current);

  return results
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map(createPromptLine);
}

// PromptLine[]を再結合してカンマ区切り文字列に変換
export function joinPromptLines(lines: PromptLine[]): string {
  return lines
    .filter((line) => line.enabled)
    .map((line) => line.text)
    .join(", ");
}

// 全行をカンマ区切りで結合（OFF行も含む、テキストエリア表示用）
export function joinAllPromptLines(lines: PromptLine[]): string {
  return lines.map((line) => line.text).join(", ");
}
