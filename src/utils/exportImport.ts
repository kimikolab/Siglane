// Siglane データの一括エクスポート/インポート

import { AppState } from "@/types";

// エクスポートファイルの型定義
export interface SiglaneExportData {
  version: 1;
  exportedAt: string;
  appState: AppState;
  dictionary: unknown[];
  annotations: Record<string, string>;
  defaultGroups: Record<string, string>;
  negativeTags: Record<string, boolean>;
}

const STORAGE_KEYS = {
  appState: "siglane-app-state",
  dictionary: "siglane-dictionary",
  annotations: "siglane-annotations",
  defaultGroups: "siglane-default-groups",
  negativeTags: "siglane-negative-tags",
} as const;

// --- エクスポート ---

export function buildExportData(): SiglaneExportData {
  const readJson = (key: string): unknown => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    appState: (readJson(STORAGE_KEYS.appState) as AppState) ?? {
      sessions: [],
      folders: [],
      activeSessionId: "",
    },
    dictionary: (readJson(STORAGE_KEYS.dictionary) as unknown[]) ?? [],
    annotations:
      (readJson(STORAGE_KEYS.annotations) as Record<string, string>) ?? {},
    defaultGroups:
      (readJson(STORAGE_KEYS.defaultGroups) as Record<string, string>) ?? {},
    negativeTags:
      (readJson(STORAGE_KEYS.negativeTags) as Record<string, boolean>) ?? {},
  };
}

export function downloadExport(data: SiglaneExportData): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  // ファイル名: siglane-backup-YYYYMMDD-HHmmss.json
  const now = new Date();
  const ts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    "-",
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");
  const filename = `siglane-backup-${ts}.json`;

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// --- インポート ---

export interface ImportResult {
  success: true;
  data: SiglaneExportData;
  sessionCount: number;
  folderCount: number;
}

export interface ImportError {
  success: false;
  error: string;
}

export function validateImportData(
  raw: unknown
): ImportResult | ImportError {
  if (!raw || typeof raw !== "object") {
    return { success: false, error: "Invalid file format" };
  }

  const data = raw as Record<string, unknown>;

  if (data.version !== 1) {
    return {
      success: false,
      error: `Unsupported version: ${data.version ?? "unknown"}`,
    };
  }

  if (!data.appState || typeof data.appState !== "object") {
    return { success: false, error: "Missing appState" };
  }

  const appState = data.appState as Record<string, unknown>;
  if (!Array.isArray(appState.sessions)) {
    return { success: false, error: "Missing sessions in appState" };
  }

  const exportData: SiglaneExportData = {
    version: 1,
    exportedAt: (data.exportedAt as string) ?? "",
    appState: data.appState as AppState,
    dictionary: Array.isArray(data.dictionary) ? data.dictionary : [],
    annotations:
      data.annotations && typeof data.annotations === "object"
        ? (data.annotations as Record<string, string>)
        : {},
    defaultGroups:
      data.defaultGroups && typeof data.defaultGroups === "object"
        ? (data.defaultGroups as Record<string, string>)
        : {},
    negativeTags:
      data.negativeTags && typeof data.negativeTags === "object"
        ? (data.negativeTags as Record<string, boolean>)
        : {},
  };

  return {
    success: true,
    data: exportData,
    sessionCount: exportData.appState.sessions.length,
    folderCount: exportData.appState.folders.length,
  };
}

export function applyImportData(data: SiglaneExportData): void {
  // appStateはpage.tsx側でsetAppStateするため、ここではそれ以外をlocalStorageに書き込む
  localStorage.setItem(
    STORAGE_KEYS.dictionary,
    JSON.stringify(data.dictionary)
  );
  localStorage.setItem(
    STORAGE_KEYS.annotations,
    JSON.stringify(data.annotations)
  );
  localStorage.setItem(
    STORAGE_KEYS.defaultGroups,
    JSON.stringify(data.defaultGroups)
  );
  localStorage.setItem(
    STORAGE_KEYS.negativeTags,
    JSON.stringify(data.negativeTags)
  );
}

export function readImportFile(file: File): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result as string));
      } catch {
        reject(new Error("Failed to parse JSON"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}
