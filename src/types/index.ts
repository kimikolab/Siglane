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
// MVP版: シンプルなカンマ分割（括弧内のカンマは将来対応）
export function parsePrompt(raw: string): PromptLine[] {
  if (!raw.trim()) return [];
  return raw
    .split(",")
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
