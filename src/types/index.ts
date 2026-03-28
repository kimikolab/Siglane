// 1行のプロンプト要素
// WPFでいうと、ItemsControlの1アイテムに相当するモデル
export interface PromptLine {
  id: string;
  text: string;
  enabled: boolean;
}

// アプリ全体の状態
// WPFでいうと、MainWindowのViewModelに相当
export interface SiglaneState {
  positiveLines: PromptLine[];
  negativeLines: PromptLine[];
  memo: string;
}

// PromptLineを新規作成するヘルパー関数
export function createPromptLine(text: string): PromptLine {
  return {
    id: crypto.randomUUID(),
    text: text.trim(),
    enabled: true,
  };
}

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
