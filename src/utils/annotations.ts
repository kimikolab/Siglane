// プロンプト注釈（アノテーション）の永続化ユーティリティ
// promptText → description のグローバルマッピング

const STORAGE_KEY = "siglane-annotations";

export type Annotations = Record<string, string>;

export function loadAnnotations(): Annotations {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Annotations;
  } catch {
    return {};
  }
}

export function saveAnnotations(annotations: Annotations): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(annotations));
}

// テキストからアノテーションキーを生成
// 重み記法を除去して正規化: "(soft lighting:1.2)" → "soft lighting"
export function normalizeForLookup(text: string): string {
  let t = text.trim();
  // (tag:weight) → tag — 数値にスペースが入るケースにも対応
  const weightMatch = t.match(/^\((.+):[\d\s.]+\)$/);
  if (weightMatch) t = weightMatch[1].trim();
  // 多重対称括弧を全段剥がす: ((tag)) → tag, {{tag}} → tag, [[tag]] → tag
  // 先頭の括弧が末尾の括弧と対応している（=その間で深さが0にならない）場合のみ剥がす
  // 例: ((a, b)) → a, b は剥がす / (a)(b) は剥がさない / (a, (b)) は剥がさない
  t = stripSymmetricBrackets(t);
  // [tag:weight] → tag （上の多重剥がしで残った単段の角括弧 + 重み付き）
  const bracketWeightMatch = t.match(/^\[(.+?):[\d\s.]+\]$/);
  if (bracketWeightMatch) t = bracketWeightMatch[1].trim();
  // <lora:name:weight> → lora:name
  const loraMatch = t.match(/^<lora:(.+?):[\d\s.]+>$/);
  if (loraMatch) t = `lora:${loraMatch[1]}`;
  // 末尾の :weight を除去（括弧なしで weight が付いている場合）
  t = t.replace(/:[\d\s.]+$/, "").trim();

  return t.toLowerCase();
}

// 対称な多重括弧 (()), {{}}, [[]] を全段剥がす
// 各反復で先頭・末尾が対応する括弧かチェック
const BRACKET_PAIRS: Record<string, string> = {
  "(": ")",
  "{": "}",
  "[": "]",
};
function stripSymmetricBrackets(text: string): string {
  let t = text;
  while (t.length >= 2) {
    const open = t[0];
    const close = BRACKET_PAIRS[open];
    if (!close || t[t.length - 1] !== close) break;
    // 先頭の open が末尾の close と対応しているか深さ計算で判定
    let depth = 0;
    let matched = true;
    for (let i = 0; i < t.length; i++) {
      if (t[i] === open) depth++;
      else if (t[i] === close) depth--;
      // 末尾以外で深さが0になった場合は対応していない（例: (a)(b)）
      if (depth === 0 && i < t.length - 1) {
        matched = false;
        break;
      }
    }
    if (!matched || depth !== 0) break;
    t = t.slice(1, -1).trim();
  }
  return t;
}

export function getAnnotation(
  annotations: Annotations,
  text: string,
): string | undefined {
  const key = normalizeForLookup(text);
  return annotations[key];
}

export function setAnnotation(
  annotations: Annotations,
  text: string,
  description: string,
): Annotations {
  const key = normalizeForLookup(text);
  const updated = { ...annotations };
  if (description.trim()) {
    updated[key] = description.trim();
  } else {
    delete updated[key];
  }
  saveAnnotations(updated);
  return updated;
}
