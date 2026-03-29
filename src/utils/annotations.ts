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
  // (tag:weight) → tag
  const weightMatch = t.match(/^\((.+):\d+\.?\d*\)$/);
  if (weightMatch) t = weightMatch[1];
  // ((tag)) → tag
  while (t.startsWith("(") && t.endsWith(")")) {
    const inner = t.slice(1, -1);
    if (inner.includes("(") || inner.includes(")")) break;
    t = inner;
  }
  // [tag] or [tag:weight] → tag
  const bracketMatch = t.match(/^\[(.+?)(?::\d+\.?\d*)?\]$/);
  if (bracketMatch) t = bracketMatch[1];
  // <lora:name:weight> → lora:name
  const loraMatch = t.match(/^<lora:(.+?):\d+\.?\d*>$/);
  if (loraMatch) t = `lora:${loraMatch[1]}`;

  return t.trim().toLowerCase();
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
