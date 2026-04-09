// ネガティブ専用タグのグローバルマッピング
// normalizedKey → true のセットとして管理

const STORAGE_KEY = "siglane-negative-tags";

export type NegativeTags = Record<string, true>;

export function loadNegativeTags(): NegativeTags {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as NegativeTags;
  } catch {
    return {};
  }
}

export function saveNegativeTags(tags: NegativeTags): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tags));
}
