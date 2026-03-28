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
}

// アプリ全体の状態
export interface AppState {
  sessions: Session[];
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
export function createSession(label: string): Session {
  return {
    id: crypto.randomUUID(),
    label,
    isTemplate: false,
    positiveLines: [],
    negativeLines: [],
    memo: "",
    updatedAt: new Date().toISOString(),
  };
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
