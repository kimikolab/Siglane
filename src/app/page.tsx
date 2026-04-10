"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  AppState,
  Session,
  Folder,
  SiglaneState,
  PromptLine,
  PromptGroup,
  ComfyGenerationOverrides,
  GenerationHistoryEntry,
  parsePrompt,
  joinPromptLines,
  joinAllPromptLines,
  createSession,
  createPromptLine,
  createFolder,
  canCreateSubfolder,
  duplicateSession,
  generateCopyLabel,
  adjustWeight,
  setWeight,
} from "@/types";
import InputArea from "@/components/InputArea";
import PromptEditor from "@/components/PromptEditor";
import MemoBox from "@/components/MemoBox";
import GenerationHistory from "@/components/GenerationHistory";
import DictionaryView from "@/components/DictionaryView";
import SessionSidebar from "@/components/SessionSidebar";
import { WeightMode } from "@/components/PromptLineItem";
import {
  parseComfyWorkflow,
  writePromptsToWorkflow,
  isParseError,
  formatGenerationParams,
} from "@/utils/comfyWorkflow";
import {
  extractComfyPngMetadata,
  generateThumbnail,
  generateThumbnailFromUrl,
} from "@/utils/pngMetadata";
import {
  type ComfySettings,
  type ComfyApiWorkflow,
  isApiFormat,
  parseComfyApiWorkflow,
  isApiParseError,
  formatApiGenerationParams,
  writePromptsToApiWorkflow,
  extractOverrides,
  applyOverrides,
  queuePrompt,
  loadComfySettings,
  saveComfySettings,
  getActiveConnection,
  createDefaultSettings,
  testConnection,
} from "@/utils/comfyApi";
import {
  loadAnnotations,
  saveAnnotations,
  setAnnotation as updateAnnotation,
  normalizeForLookup,
} from "@/utils/annotations";
import {
  watchExecution,
  type ComfyExecutionResult,
} from "@/utils/comfyWebSocket";
import {
  type LlmSettings,
  loadLlmSettings,
  saveLlmSettings,
  testLlmConnection,
  translateTags,
  createDefaultLlmSettings,
} from "@/utils/llmApi";
import {
  type DefaultGroups,
  loadDefaultGroups,
  saveDefaultGroups,
  recordDefaultGroup,
  removeDefaultGroup,
} from "@/utils/defaultGroups";
import {
  type NegativeTags,
  loadNegativeTags,
  saveNegativeTags,
} from "@/utils/negativeTags";

const STORAGE_KEY = "siglane-app-state";
const LEGACY_STORAGE_KEY = "siglane-state";

function createSampleSession(): Session {
  const session = createSession("Sample prompt");
  session.positiveLines = parsePrompt(
    "masterpiece, best quality, 1girl, smile, blue hair, (soft lighting:1.2), <lora:add_detail:0.8>, bokeh"
  );
  session.negativeLines = parsePrompt(
    "worst quality, low quality, normal quality, lowres"
  );
  session.memo = "seed: 12345 / cfg: 7 / steps: 28 / model: animagine-xl";
  return session;
}

function migrateFromLegacy(legacy: SiglaneState): AppState {
  const session: Session = {
    id: crypto.randomUUID(),
    label: "Migrated session",
    isTemplate: false,
    positiveLines: legacy.positiveLines,
    negativeLines: legacy.negativeLines,
    memo: legacy.memo,
    updatedAt: new Date().toISOString(),
    folderId: null,
  };
  return { sessions: [session], folders: [], activeSessionId: session.id };
}

// 既存AppStateにfolders/folderIdがない場合のマイグレーション
function migrateAppState(state: AppState): AppState {
  const needsFolders = !Array.isArray(state.folders);
  const needsFolderId = state.sessions.some(
    (s) => s.folderId === undefined,
  );

  if (!needsFolders && !needsFolderId) return state;

  return {
    ...state,
    folders: needsFolders ? [] : state.folders,
    sessions: needsFolderId
      ? state.sessions.map((s) => ({
          ...s,
          folderId: s.folderId ?? null,
        }))
      : state.sessions,
  };
}

function createInitialState(): AppState {
  const sample = createSampleSession();
  return { sessions: [sample], folders: [], activeSessionId: sample.id };
}

export default function Home() {
  const [appState, setAppState] = useState<AppState>({
    sessions: [],
    folders: [],
    activeSessionId: "",
  });
  const [loaded, setLoaded] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isRenamingHeader, setIsRenamingHeader] = useState(false);
  const [headerRenameValue, setHeaderRenameValue] = useState("");
  const [weightMode, setWeightMode] = useState<WeightMode>("combined");
  const [viewMode, setViewMode] = useState<"flat" | "outline">("flat");
  const [isDictionaryView, setIsDictionaryView] = useState(false);

  // --- プロンプト注釈 ---
  const [annotations, setAnnotations] = useState<Record<string, string>>({});
  const [showBulkAnnotation, setShowBulkAnnotation] = useState(false);
  const [bulkAnnotationText, setBulkAnnotationText] = useState("");
  const [defaultGroups, setDefaultGroups] = useState<DefaultGroups>({});
  const [negativeTags, setNegativeTags] = useState<NegativeTags>({});
  useEffect(() => {
    setAnnotations(loadAnnotations());
    setDefaultGroups(loadDefaultGroups());
    setNegativeTags(loadNegativeTags());
  }, []);
  const isInitial = useRef(true);

  // --- localStorage読み込み ---
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as AppState;
        if (parsed.sessions && parsed.sessions.length > 0) {
          setAppState(migrateAppState(parsed));
          setLoaded(true);
          return;
        }
      } catch {}
    }

    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      try {
        const parsed = JSON.parse(legacy) as SiglaneState;
        if (parsed.positiveLines || parsed.negativeLines) {
          const migrated = migrateFromLegacy(parsed);
          setAppState(migrated);
          localStorage.removeItem(LEGACY_STORAGE_KEY);
          setLoaded(true);
          return;
        }
      } catch {}
    }

    setAppState(createInitialState());
    setLoaded(true);
  }, []);

  // --- 自動保存 ---
  useEffect(() => {
    if (!loaded) return;
    if (isInitial.current) {
      isInitial.current = false;
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
    setSavedFlash(true);
    const timer = setTimeout(() => setSavedFlash(false), 1500);
    return () => clearTimeout(timer);
  }, [appState, loaded]);

  const activeSession = appState.sessions.find(
    (s) => s.id === appState.activeSessionId
  );

  const updateActiveSession = useCallback(
    (updater: (session: Session) => Session) => {
      setAppState((prev) => ({
        ...prev,
        sessions: prev.sessions.map((s) =>
          s.id === prev.activeSessionId
            ? updater({ ...s, updatedAt: new Date().toISOString() })
            : s
        ),
      }));
    },
    []
  );

  // --- セッション管理 ---
  const handleNewSession = (folderId?: string | null) => {
    const existingLabels = appState.sessions.map((s) => s.label);
    const label = generateCopyLabel("New session", existingLabels);
    const session = createSession(label, folderId ?? null);
    setAppState((prev) => ({
      ...prev,
      sessions: [...prev.sessions, session],
      activeSessionId: session.id,
    }));
  };

  const handleSelectSession = (id: string) => {
    setAppState((prev) => ({ ...prev, activeSessionId: id }));
    setIsDictionaryView(false);
  };

  const handleDuplicateSession = (id: string) => {
    const source = appState.sessions.find((s) => s.id === id);
    if (!source) return;
    const existingLabels = appState.sessions.map((s) => s.label);
    const newLabel = generateCopyLabel(source.label, existingLabels);
    const copy = duplicateSession(source, newLabel);
    setAppState((prev) => ({
      ...prev,
      sessions: [...prev.sessions, copy],
      activeSessionId: copy.id,
    }));
  };

  const handleDeleteSession = (id: string) => {
    setAppState((prev) => {
      const remaining = prev.sessions.filter((s) => s.id !== id);
      if (remaining.length === 0) {
        const fresh = createSession("New session");
        return { ...prev, sessions: [fresh], activeSessionId: fresh.id };
      }
      const newActiveId =
        prev.activeSessionId === id ? remaining[0].id : prev.activeSessionId;
      return { ...prev, sessions: remaining, activeSessionId: newActiveId };
    });
  };

  const handleRenameSession = (id: string, newLabel: string) => {
    setAppState((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s) =>
        s.id === id
          ? { ...s, label: newLabel, updatedAt: new Date().toISOString() }
          : s
      ),
    }));
  };

  const handleToggleTemplate = (id: string) => {
    setAppState((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s) =>
        s.id === id ? { ...s, isTemplate: !s.isTemplate } : s
      ),
    }));
  };

  const handleOpenFromTemplate = (id: string) => {
    const template = appState.sessions.find((s) => s.id === id);
    if (!template) return;
    const existingLabels = appState.sessions.map((s) => s.label);
    const newLabel = generateCopyLabel(template.label, existingLabels);
    const copy = duplicateSession(template, newLabel);
    setAppState((prev) => ({
      ...prev,
      sessions: [...prev.sessions, copy],
      activeSessionId: copy.id,
    }));
  };

  // --- フォルダ管理 ---
  const handleNewFolder = (parentId: string | null) => {
    if (parentId !== null && !canCreateSubfolder(parentId, appState.folders)) {
      return;
    }
    const existingLabels = appState.folders.map((f) => f.label);
    const label = generateCopyLabel("New folder", existingLabels);
    const maxOrder = appState.folders
      .filter((f) => f.parentId === parentId)
      .reduce((max, f) => Math.max(max, f.order), -1);
    const folder = createFolder(label, parentId, maxOrder + 1);
    setAppState((prev) => ({
      ...prev,
      folders: [...prev.folders, folder],
    }));
  };

  const handleRenameFolder = (id: string, newLabel: string) => {
    setAppState((prev) => ({
      ...prev,
      folders: prev.folders.map((f) =>
        f.id === id ? { ...f, label: newLabel } : f,
      ),
    }));
  };

  const handleDeleteFolder = (id: string) => {
    setAppState((prev) => {
      // 削除対象のフォルダ + その子サブフォルダのIDを収集
      const idsToDelete = new Set<string>();
      idsToDelete.add(id);
      for (const f of prev.folders) {
        if (f.parentId === id) idsToDelete.add(f.id);
      }

      return {
        ...prev,
        folders: prev.folders.filter((f) => !idsToDelete.has(f.id)),
        // フォルダ内のセッションはUnfiledに戻す
        sessions: prev.sessions.map((s) =>
          s.folderId && idsToDelete.has(s.folderId)
            ? { ...s, folderId: null }
            : s,
        ),
      };
    });
  };

  const handleMoveSession = (sessionId: string, folderId: string | null) => {
    setAppState((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s) =>
        s.id === sessionId
          ? { ...s, folderId, updatedAt: new Date().toISOString() }
          : s,
      ),
    }));
  };

  // --- ComfyUI連携 ---
  const comfyFileRef = useRef<HTMLInputElement>(null);
  const pngFileRef = useRef<HTMLInputElement>(null);

  const handleImportComfyWorkflow = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        const result = parseComfyWorkflow(json);

        if (isParseError(result)) {
          alert(`Workflow import failed: ${result.error}`);
          return;
        }

        updateActiveSession((s) => {
          const posParsed = parsePrompt(result.positivePrompt);
          const negParsed = parsePrompt(result.negativePrompt);
          const pos = applyDefaultGroupsToLines(posParsed, s.positiveGroups);
          const neg = applyDefaultGroupsToLines(negParsed, s.negativeGroups);
          return {
            ...s,
            positiveLines: pos.lines,
            positiveGroups: pos.groups,
            negativeLines: neg.lines,
            negativeGroups: neg.groups,
            memo: formatGenerationParams(result.generationParams),
            comfyWorkflow: json,
            comfyPositiveNodeId: result.positiveNodeId,
            comfyNegativeNodeId: result.negativeNodeId,
          };
        });
      } catch {
        alert("Failed to parse JSON file");
      }
    };
    reader.readAsText(file);
  };

  // ComfyUI生成PNGを読み込む: メタデータ抽出 + サムネイル生成
  const handleImportComfyPng = async (file: File) => {
    try {
      const [metadata, thumbnail] = await Promise.all([
        extractComfyPngMetadata(file),
        generateThumbnail(file, 256),
      ]);

      // workflowがあればUI形式として取り込む
      const workflow = metadata.workflow;
      if (workflow) {
        const result = parseComfyWorkflow(workflow);
        if (!isParseError(result)) {
          updateActiveSession((s) => {
            const posParsed = parsePrompt(result.positivePrompt);
            const negParsed = parsePrompt(result.negativePrompt);
            const pos = applyDefaultGroupsToLines(posParsed, s.positiveGroups);
            const neg = applyDefaultGroupsToLines(negParsed, s.negativeGroups);
            return {
              ...s,
              positiveLines: pos.lines,
              positiveGroups: pos.groups,
              negativeLines: neg.lines,
              negativeGroups: neg.groups,
              memo: formatGenerationParams(result.generationParams),
              comfyWorkflow: workflow,
              comfyPositiveNodeId: result.positiveNodeId,
              comfyNegativeNodeId: result.negativeNodeId,
              thumbnailDataUrl: thumbnail,
            };
          });
          return;
        }
      }

      // workflowなし or パース失敗: サムネイルだけ保存
      updateActiveSession((s) => ({ ...s, thumbnailDataUrl: thumbnail }));
    } catch (err) {
      console.error("PNG import failed:", err);
      alert("Failed to read PNG metadata");
    }
  };

  const handleExportComfyWorkflow = () => {
    if (
      !activeSession?.comfyWorkflow ||
      activeSession.comfyPositiveNodeId === undefined ||
      activeSession.comfyNegativeNodeId === undefined
    ) {
      return;
    }

    const positiveText = joinPromptLines(activeSession.positiveLines);
    const negativeText = joinPromptLines(activeSession.negativeLines);

    const exported = writePromptsToWorkflow(
      activeSession.comfyWorkflow,
      activeSession.comfyPositiveNodeId,
      activeSession.comfyNegativeNodeId,
      positiveText,
      negativeText,
    );

    const blob = new Blob([JSON.stringify(exported, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeSession.label}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- ヘッダーリネーム ---
  const startHeaderRename = () => {
    if (!activeSession || activeSession.isTemplate) return;
    setHeaderRenameValue(activeSession.label);
    setIsRenamingHeader(true);
  };

  const commitHeaderRename = () => {
    if (activeSession && headerRenameValue.trim()) {
      handleRenameSession(activeSession.id, headerRenameValue.trim());
    }
    setIsRenamingHeader(false);
  };

  // --- エディタ操作 ---
  const handleSyncPositive = (text: string) => {
    updateActiveSession((s) => {
      const parsed = parsePrompt(text);
      const { lines, groups } = applyDefaultGroupsToLines(parsed, s.positiveGroups);
      return { ...s, positiveLines: lines, positiveGroups: groups };
    });
  };

  const handleSyncNegative = (text: string) => {
    updateActiveSession((s) => {
      const parsed = parsePrompt(text);
      const { lines, groups } = applyDefaultGroupsToLines(parsed, s.negativeGroups);
      return { ...s, negativeLines: lines, negativeGroups: groups };
    });
  };

  const handleToggle = (type: "positive" | "negative", id: string) => {
    const key = type === "positive" ? "positiveLines" : "negativeLines";
    updateActiveSession((s) => ({
      ...s,
      [key]: (s[key] as PromptLine[]).map((line) =>
        line.id === id ? { ...line, enabled: !line.enabled } : line
      ),
    }));
  };

  const handleDelete = (type: "positive" | "negative", id: string) => {
    const key = type === "positive" ? "positiveLines" : "negativeLines";
    updateActiveSession((s) => ({
      ...s,
      [key]: (s[key] as PromptLine[]).filter((line) => line.id !== id),
    }));
  };

  const handleUpdate = (
    type: "positive" | "negative",
    id: string,
    newText: string
  ) => {
    const key = type === "positive" ? "positiveLines" : "negativeLines";
    const parsed = parsePrompt(newText);

    if (parsed.length <= 1) {
      updateActiveSession((s) => ({
        ...s,
        [key]: (s[key] as PromptLine[]).map((line) =>
          line.id === id ? { ...line, text: newText.trim() } : line
        ),
      }));
    } else {
      updateActiveSession((s) => {
        const lines = [...(s[key] as PromptLine[])];
        const index = lines.findIndex((l) => l.id === id);
        if (index === -1) return s;
        // 元の行のgroupIdを分割後の全行に継承
        const originalGroupId = lines[index].groupId;
        const newLines = parsed.map((l) => ({ ...l, groupId: originalGroupId }));
        lines.splice(index, 1, ...newLines);
        return { ...s, [key]: lines };
      });
    }
  };

  const handleAdd = (type: "positive" | "negative", line: PromptLine) => {
    const key = type === "positive" ? "positiveLines" : "negativeLines";
    updateActiveSession((s) => ({
      ...s,
      [key]: [...(s[key] as PromptLine[]), line],
    }));
  };

  const handleDuplicate = (type: "positive" | "negative", id: string) => {
    const key = type === "positive" ? "positiveLines" : "negativeLines";
    updateActiveSession((s) => {
      const lines = [...(s[key] as PromptLine[])];
      const index = lines.findIndex((l) => l.id === id);
      if (index === -1) return s;
      const original = lines[index];
      const copy: PromptLine = {
        id: crypto.randomUUID(),
        text: original.text,
        enabled: original.enabled,
      };
      lines.splice(index + 1, 0, copy);
      return { ...s, [key]: lines };
    });
  };

  const handleReorder = (
    type: "positive" | "negative",
    activeId: string,
    overId: string
  ) => {
    const key = type === "positive" ? "positiveLines" : "negativeLines";
    updateActiveSession((s) => {
      const lines = [...(s[key] as PromptLine[])];
      const oldIndex = lines.findIndex((l) => l.id === activeId);
      const newIndex = lines.findIndex((l) => l.id === overId);
      const [moved] = lines.splice(oldIndex, 1);
      lines.splice(newIndex, 0, moved);
      return { ...s, [key]: lines };
    });
  };

  const handleMemoChange = (memo: string) => {
    updateActiveSession((s) => ({ ...s, memo }));
  };

  // --- 重み操作 ---
  const handleWeightChange = (
    type: "positive" | "negative",
    id: string,
    delta: number
  ) => {
    const key = type === "positive" ? "positiveLines" : "negativeLines";
    updateActiveSession((s) => ({
      ...s,
      [key]: (s[key] as PromptLine[]).map((line) =>
        line.id === id ? { ...line, text: adjustWeight(line.text, delta) } : line
      ),
    }));
  };

  const handleWeightSet = (
    type: "positive" | "negative",
    id: string,
    weight: number
  ) => {
    const key = type === "positive" ? "positiveLines" : "negativeLines";
    updateActiveSession((s) => ({
      ...s,
      [key]: (s[key] as PromptLine[]).map((line) =>
        line.id === id ? { ...line, text: setWeight(line.text, weight) } : line
      ),
    }));
  };

  // --- ヘルプオーバーレイ ---
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      // Ctrl+Enter: Generate
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleGenerateRef.current();
        return;
      }
      if (
        (e.key === "?" || (e.key === "/" && e.shiftKey)) &&
        !e.ctrlKey &&
        !e.metaKey
      ) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        setShowHelp((prev) => !prev);
      }
      if (e.key === "Escape") {
        setShowHelp(false);
        setIsRenamingHeader(false);
        setShowApiWorkflowModal(false);
        setShowComfySettingsModal(false);
        setShowLlmSettingsModal(false);
      }
    };
    window.addEventListener("keydown", handleGlobalKey);
    return () => window.removeEventListener("keydown", handleGlobalKey);
  }, []);

  // --- セクション単位のグループ操作 ---

  // デフォルトグループを未割り当ての行に自動適用
  const applyDefaultGroupsToLines = useCallback(
    (
      lines: PromptLine[],
      existingGroups: PromptGroup[] | undefined,
    ): { lines: PromptLine[]; groups: PromptGroup[] } => {
      const groups = [...(existingGroups ?? [])];
      const updatedLines = lines.map((l) => {
        if (l.groupId) return l; // 既に割り当て済み
        const label = defaultGroups[normalizeForLookup(l.text)];
        if (!label) return l;
        // グループを探すか作成
        let group = groups.find((g) => g.label === label);
        if (!group) {
          group = { id: crypto.randomUUID(), label, order: groups.length };
          groups.push(group);
        }
        return { ...l, groupId: group.id };
      });
      return { lines: updatedLines, groups };
    },
    [defaultGroups],
  );

  const handleSetGroup = useCallback(
    (type: "positive" | "negative", lineIds: string[], groupLabel: string) => {
      updateActiveSession((s) => {
        const groupsKey = type === "positive" ? "positiveGroups" : "negativeGroups";
        const linesKey = type === "positive" ? "positiveLines" : "negativeLines";
        const groups = [...(s[groupsKey] ?? [])];

        let group = groups.find((g) => g.label === groupLabel);
        if (!group) {
          group = { id: crypto.randomUUID(), label: groupLabel, order: groups.length };
          groups.push(group);
        }
        const gid = group.id;
        const idSet = new Set(lineIds);

        // デフォルトグループを記録
        const lines = s[linesKey] as PromptLine[];
        setDefaultGroups((prev) => {
          let updated = prev;
          for (const l of lines) {
            if (idSet.has(l.id)) {
              updated = recordDefaultGroup(updated, l.text, groupLabel);
            }
          }
          return updated;
        });

        return {
          ...s,
          [linesKey]: lines.map((l) =>
            idSet.has(l.id) ? { ...l, groupId: gid } : l,
          ),
          [groupsKey]: groups,
        };
      });
    },
    [updateActiveSession],
  );

  const handleSectionBulkToggle = useCallback(
    (type: "positive" | "negative", lineIds: string[], enabled: boolean) => {
      const key = type === "positive" ? "positiveLines" : "negativeLines";
      const idSet = new Set(lineIds);
      updateActiveSession((s) => ({
        ...s,
        [key]: (s[key] as PromptLine[]).map((l) =>
          idSet.has(l.id) ? { ...l, enabled } : l,
        ),
      }));
    },
    [updateActiveSession],
  );

  const handleUngroup = useCallback(
    (type: "positive" | "negative", lineIds: string[]) => {
      const key = type === "positive" ? "positiveLines" : "negativeLines";
      const idSet = new Set(lineIds);
      updateActiveSession((s) => ({
        ...s,
        [key]: (s[key] as PromptLine[]).map((l) =>
          idSet.has(l.id) ? { ...l, groupId: undefined } : l,
        ),
      }));
    },
    [updateActiveSession],
  );

  // 行単位のグループ変更（Selectモード不要）
  const handleSetLineGroup = useCallback(
    (type: "positive" | "negative", id: string, groupLabel: string | null) => {
      if (groupLabel === null) {
        const key = type === "positive" ? "positiveLines" : "negativeLines";
        updateActiveSession((s) => {
          const line = (s[key] as PromptLine[]).find((l) => l.id === id);
          if (line) {
            setDefaultGroups((prev) => removeDefaultGroup(prev, line.text));
          }
          return {
            ...s,
            [key]: (s[key] as PromptLine[]).map((l) =>
              l.id === id ? { ...l, groupId: undefined } : l,
            ),
          };
        });
      } else {
        handleSetGroup(type, [id], groupLabel);
      }
    },
    [handleSetGroup, updateActiveSession],
  );

  // グループのプリセット差し替え
  // 既存のグループ行をOFFにして、プリセットの行をON状態で挿入
  const handleReplaceGroup = useCallback(
    (type: "positive" | "negative", groupId: string, groupLabel: string, newPrompts: string[]) => {
      const linesKey = type === "positive" ? "positiveLines" : "negativeLines";
      updateActiveSession((s) => {
        const lines = [...(s[linesKey] as PromptLine[])];

        // 既存のグループ行をOFFに
        let lastGroupIndex = -1;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].groupId === groupId) {
            lines[i] = { ...lines[i], enabled: false };
            lastGroupIndex = i;
          }
        }

        // 新しい行を作成（同じgroupIdを付与）
        const newLines = newPrompts.map((text) => ({
          ...createPromptLine(text),
          groupId,
        }));

        // 最後のグループ行の直後に挿入
        const insertAt = lastGroupIndex === -1 ? lines.length : lastGroupIndex + 1;
        lines.splice(insertAt, 0, ...newLines);

        return { ...s, [linesKey]: lines };
      });
    },
    [updateActiveSession],
  );

  const handleReplaceSelection = useCallback(
    (type: "positive" | "negative", selectedIds: string[], groupLabel: string, newPrompts: string[]) => {
      const linesKey = type === "positive" ? "positiveLines" : "negativeLines";
      const groupsKey = type === "positive" ? "positiveGroups" : "negativeGroups";
      updateActiveSession((s) => {
        const lines = [...(s[linesKey] as PromptLine[])];
        const groups = [...(s[groupsKey] ?? [])];
        const idSet = new Set(selectedIds);

        // グループを検索、なければ作成
        let group = groups.find((g) => g.label === groupLabel);
        if (!group) {
          group = { id: crypto.randomUUID(), label: groupLabel, order: groups.length };
          groups.push(group);
        }
        const gid = group.id;

        // 選択行をOFFにし、最後の選択行の位置を記録
        let lastSelectedIndex = -1;
        for (let i = 0; i < lines.length; i++) {
          if (idSet.has(lines[i].id)) {
            lines[i] = { ...lines[i], enabled: false };
            lastSelectedIndex = i;
          }
        }

        // 新しい行を作成（プリセットのカテゴリのgroupIdを付与）
        const newLines = newPrompts.map((text) => ({
          ...createPromptLine(text),
          groupId: gid,
        }));

        // 最後の選択行の直後に挿入
        const insertAt = lastSelectedIndex === -1 ? lines.length : lastSelectedIndex + 1;
        lines.splice(insertAt, 0, ...newLines);

        return { ...s, [linesKey]: lines, [groupsKey]: groups };
      });
    },
    [updateActiveSession],
  );

  const handleSetAnnotation = useCallback(
    (text: string, description: string) => {
      setAnnotations((prev) => updateAnnotation(prev, text, description));
    },
    [],
  );

  // --- 辞書管理画面用ハンドラ（normalizedキーで直接操作） ---
  const handleDictUpdateAnnotation = useCallback(
    (key: string, description: string) => {
      setAnnotations((prev) => {
        const updated = { ...prev };
        if (description.trim()) {
          updated[key] = description.trim();
        } else {
          delete updated[key];
        }
        saveAnnotations(updated);
        return updated;
      });
    },
    [],
  );

  const handleDictDeleteAnnotation = useCallback(
    (key: string) => {
      setAnnotations((prev) => {
        const updated = { ...prev };
        delete updated[key];
        saveAnnotations(updated);
        return updated;
      });
    },
    [],
  );

  const handleDictUpdateGroup = useCallback(
    (key: string, group: string | null) => {
      setDefaultGroups((prev) => {
        const updated = { ...prev };
        if (group) {
          updated[key] = group;
        } else {
          delete updated[key];
        }
        saveDefaultGroups(updated);
        return updated;
      });
    },
    [],
  );

  const isTemplateActive = activeSession?.isTemplate ?? false;

  // --- ComfyUI API連携 ---
  const [comfySettings, setComfySettings] = useState<ComfySettings>(createDefaultSettings);
  const [showApiWorkflowModal, setShowApiWorkflowModal] = useState(false);
  const [showComfySettingsModal, setShowComfySettingsModal] = useState(false);
  const [generateToast, setGenerateToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const wsCleanupRef = useRef<(() => void) | null>(null);
  const apiWorkflowFileRef = useRef<HTMLInputElement>(null);

  // ComfyUI設定をlocalStorageから読み込み
  useEffect(() => {
    setComfySettings(loadComfySettings());
  }, []);

  // --- LLM連携 ---
  const [llmSettings, setLlmSettings] = useState<LlmSettings>(createDefaultLlmSettings);
  const [showLlmSettingsModal, setShowLlmSettingsModal] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

  useEffect(() => {
    setLlmSettings(loadLlmSettings());
  }, []);

  // WebSocketクリーンアップ（アンマウント時）
  useEffect(() => {
    return () => {
      wsCleanupRef.current?.();
    };
  }, []);

  // トースト自動消去
  useEffect(() => {
    if (!generateToast) return;
    const timer = setTimeout(() => setGenerateToast(null), 4000);
    return () => clearTimeout(timer);
  }, [generateToast]);

  const handleImportApiWorkflow = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target?.result as string);

          if (!isApiFormat(json)) {
            setGenerateToast({
              message:
                "This is not an API format workflow. In ComfyUI, enable Dev mode and use 'Save (API Format)'.",
              type: "error",
            });
            return;
          }

          const result = parseComfyApiWorkflow(json);
          if (isApiParseError(result)) {
            setGenerateToast({
              message: `API workflow import failed: ${result.error}`,
              type: "error",
            });
            return;
          }

          updateActiveSession((s) => ({
            ...s,
            comfyApiWorkflow: json as Record<string, unknown>,
            comfyApiPositiveNodeId: result.positiveNodeId,
            comfyApiNegativeNodeId: result.negativeNodeId,
            comfyOverrides: extractOverrides(json as ComfyApiWorkflow),
          }));

          setShowApiWorkflowModal(false);
          setGenerateToast({
            message: "API workflow loaded. Ready to generate!",
            type: "success",
          });
        } catch {
          setGenerateToast({
            message: "Failed to parse JSON file",
            type: "error",
          });
        }
      };
      reader.readAsText(file);
    },
    [updateActiveSession],
  );

  const handleGenerate = useCallback(async () => {
    if (!activeSession) return;

    // API workflowが未設定 → インポートモーダルを出す
    if (
      !activeSession.comfyApiWorkflow ||
      !activeSession.comfyApiPositiveNodeId ||
      !activeSession.comfyApiNegativeNodeId
    ) {
      setShowApiWorkflowModal(true);
      return;
    }

    const conn = getActiveConnection(comfySettings);
    if (!conn) {
      setShowComfySettingsModal(true);
      return;
    }

    setIsGenerating(true);

    const positiveText = joinPromptLines(activeSession.positiveLines);
    const negativeText = joinPromptLines(activeSession.negativeLines);

    const updatedWorkflow = writePromptsToApiWorkflow(
      activeSession.comfyApiWorkflow,
      activeSession.comfyApiPositiveNodeId,
      activeSession.comfyApiNegativeNodeId,
      positiveText,
      negativeText,
    );

    // オーバーライド値をサンプラーノードに適用（seed, cfg, steps等）
    const overrides = activeSession.comfyOverrides ?? {
      seed: "random" as const,
      cfg: 7,
      steps: 20,
      samplerName: "euler",
      scheduler: "normal",
      denoise: 1.0,
    };
    const finalWorkflow = applyOverrides(updatedWorkflow, overrides);

    const result = await queuePrompt(conn, finalWorkflow);

    setIsGenerating(false);

    if (result.success) {
      setGenerateToast({ message: "Queued!", type: "success" });

      // WebSocketで生成完了を監視
      if (result.promptId && conn) {
        wsCleanupRef.current?.();

        const snapshotOverrides = { ...overrides };
        const snapshotSessionId = appState.activeSessionId;
        // applyOverridesでランダム化されたseedを取得
        if (snapshotOverrides.seed === "random") {
          for (const node of Object.values(finalWorkflow)) {
            if (typeof node.inputs?.seed === "number") {
              snapshotOverrides.seed = node.inputs.seed as number;
              break;
            }
          }
        }

        wsCleanupRef.current = watchExecution(
          conn,
          result.promptId,
          (execResult: ComfyExecutionResult) => {
            const historyEntry: GenerationHistoryEntry = {
              id: crypto.randomUUID(),
              promptId: execResult.promptId,
              positivePrompt: positiveText,
              negativePrompt: negativeText,
              overrides: snapshotOverrides,
              imageUrls: execResult.imageUrls,
              createdAt: new Date().toISOString(),
            };

            // 履歴をセッションに追加
            setAppState((prev) => ({
              ...prev,
              sessions: prev.sessions.map((s) =>
                s.id === snapshotSessionId
                  ? {
                      ...s,
                      generationHistory: [
                        ...(s.generationHistory ?? []),
                        historyEntry,
                      ],
                      updatedAt: new Date().toISOString(),
                    }
                  : s
              ),
            }));

            // 手動PNG importがない場合のみ、生成画像を自動サムネイルに設定
            // setAppStateの外でcurrent stateを参照するためfunctional formで確認
            const firstUrl = execResult.imageUrls[0];
            if (firstUrl) {
              setAppState((prev) => {
                const session = prev.sessions.find(
                  (s) => s.id === snapshotSessionId,
                );
                // 手動importのサムネイルがあれば何もしない
                if (session?.thumbnailDataUrl) return prev;
                // なければ非同期でサムネイルを取得
                generateThumbnailFromUrl(firstUrl)
                  .then((dataUrl) => {
                    setAppState((prev2) => ({
                      ...prev2,
                      sessions: prev2.sessions.map((s) =>
                        s.id === snapshotSessionId && !s.thumbnailDataUrl
                          ? { ...s, thumbnailDataUrl: dataUrl }
                          : s,
                      ),
                    }));
                  })
                  .catch(() => {
                    // ComfyUIオフライン等、取得失敗は無視
                  });
                return prev; // stateは変えない（非同期完了後に別途更新）
              });
            }

            setGenerateToast({
              message: `Done! ${execResult.imageUrls.length} image(s)`,
              type: "success",
            });
            wsCleanupRef.current = null;
          },
          (error: string) => {
            setGenerateToast({ message: error, type: "error" });
            wsCleanupRef.current = null;
          },
        );
      }
    } else {
      setGenerateToast({
        message: result.error ?? "Failed to queue prompt",
        type: "error",
      });
    }
  }, [activeSession, comfySettings]);

  const handleSaveComfySettings = useCallback(
    (newSettings: ComfySettings) => {
      setComfySettings(newSettings);
      saveComfySettings(newSettings);
      setShowComfySettingsModal(false);
    },
    [],
  );

  const handleUpdateOverrides = useCallback(
    (updates: Partial<ComfyGenerationOverrides>) => {
      updateActiveSession((s) => ({
        ...s,
        comfyOverrides: s.comfyOverrides
          ? { ...s.comfyOverrides, ...updates }
          : undefined,
      }));
    },
    [updateActiveSession],
  );

  // handleGenerateの最新参照をrefで保持（useEffect内から呼ぶため）
  const handleGenerateRef = useRef(handleGenerate);
  useEffect(() => {
    handleGenerateRef.current = handleGenerate;
  }, [handleGenerate]);

  const positiveAllText = activeSession
    ? joinAllPromptLines(activeSession.positiveLines)
    : "";
  const negativeAllText = activeSession
    ? joinAllPromptLines(activeSession.negativeLines)
    : "";
  const positiveCopyText = activeSession
    ? joinPromptLines(activeSession.positiveLines)
    : "";
  const negativeCopyText = activeSession
    ? joinPromptLines(activeSession.negativeLines)
    : "";

  return (
    <div className="h-screen flex bg-neutral-900 text-neutral-100">
      {/* 左サイドバー */}
      <SessionSidebar
        sessions={appState.sessions}
        folders={appState.folders}
        activeSessionId={appState.activeSessionId}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        onDuplicateSession={handleDuplicateSession}
        onDeleteSession={handleDeleteSession}
        onRenameSession={handleRenameSession}
        onToggleTemplate={handleToggleTemplate}
        onOpenFromTemplate={handleOpenFromTemplate}
        onMoveSession={handleMoveSession}
        onNewFolder={handleNewFolder}
        onRenameFolder={handleRenameFolder}
        onDeleteFolder={handleDeleteFolder}
        isDictionaryActive={isDictionaryView}
        onOpenDictionary={() => setIsDictionaryView(true)}
      />

      {/* メインエディタ */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6">
          {isDictionaryView ? (
            <DictionaryView
              annotations={annotations}
              defaultGroups={defaultGroups}
              onUpdateAnnotation={handleDictUpdateAnnotation}
              onDeleteAnnotation={handleDictDeleteAnnotation}
              onUpdateGroup={handleDictUpdateGroup}
            />
          ) : (
          <>
          {/* ステータスバー */}
          <div className="flex items-start justify-between mb-5">
            {/* 左: セッション名 + テンプレートバッジ */}
            <div className="min-w-0 flex-1">
              {activeSession && (
                <div className="flex flex-col gap-1">
                  {/* フォルダパス */}
                  {(() => {
                    if (!activeSession.folderId) return null;
                    const folder = appState.folders.find(
                      (f) => f.id === activeSession.folderId,
                    );
                    if (!folder) return null;
                    const parts: string[] = [];
                    if (folder.parentId) {
                      const parent = appState.folders.find(
                        (f) => f.id === folder.parentId,
                      );
                      if (parent) parts.push(parent.label);
                    }
                    parts.push(folder.label);
                    return (
                      <span className="text-xs text-neutral-500 truncate">
                        {parts.join(" / ")}
                      </span>
                    );
                  })()}
                  {isRenamingHeader ? (
                    <input
                      type="text"
                      value={headerRenameValue}
                      onChange={(e) => setHeaderRenameValue(e.target.value)}
                      onBlur={commitHeaderRename}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitHeaderRename();
                        if (e.key === "Escape") setIsRenamingHeader(false);
                      }}
                      autoFocus
                      className="bg-neutral-800 border border-neutral-600 rounded px-2.5 py-1.5 text-sm text-neutral-200 font-medium focus:outline-none focus:border-neutral-400 max-w-sm"
                    />
                  ) : (
                    <span
                      onClick={startHeaderRename}
                      className={`text-base font-medium ${
                        isTemplateActive
                          ? "text-neutral-400 cursor-default"
                          : "text-neutral-100 cursor-text hover:text-white"
                      }`}
                      title={
                        isTemplateActive
                          ? "Templates cannot be renamed here"
                          : "Click to rename"
                      }
                    >
                      {activeSession.label}
                    </span>
                  )}
                  {isTemplateActive && (
                    <span className="text-[10px] text-amber-600 uppercase tracking-wider bg-amber-900/20 px-2 py-0.5 rounded w-fit">
                      Template — read only
                    </span>
                  )}
                  {/* ComfyUI連携 */}
                  {!isTemplateActive && (
                    <div className="flex items-center gap-3 mt-1">
                      <input
                        ref={comfyFileRef}
                        type="file"
                        accept=".json"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImportComfyWorkflow(file);
                          e.target.value = "";
                        }}
                      />
                      <input
                        ref={pngFileRef}
                        type="file"
                        accept="image/png"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImportComfyPng(file);
                          e.target.value = "";
                        }}
                      />
                      <button
                        onClick={() => comfyFileRef.current?.click()}
                        className="text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors"
                      >
                        Import workflow
                      </button>
                      <button
                        onClick={() => pngFileRef.current?.click()}
                        className="text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors"
                      >
                        Import PNG
                      </button>
                      {activeSession?.comfyWorkflow != null && (
                        <button
                          onClick={handleExportComfyWorkflow}
                          className="text-[11px] text-sky-600 hover:text-sky-400 transition-colors"
                        >
                          Export for ComfyUI
                        </button>
                      )}
                    </div>
                  )}
                  {/* PNG サムネイル */}
                  {activeSession?.thumbnailDataUrl && (
                    <div className="flex items-center gap-2 mt-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={activeSession.thumbnailDataUrl}
                        alt="Generated image thumbnail"
                        className="h-16 w-auto rounded border border-neutral-700 object-cover cursor-pointer hover:border-neutral-500 transition-colors"
                        title="Click to remove thumbnail"
                        onClick={() =>
                          updateActiveSession((s) => ({
                            ...s,
                            thumbnailDataUrl: undefined,
                          }))
                        }
                      />
                      <span className="text-[10px] text-neutral-600">
                        Click to remove
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 右: 生成 + 接続設定 + 重みモード + ショートカット + 保存状態 */}
            <div className="flex items-center gap-4 flex-shrink-0 pt-1">
              {/* ComfyUI Generate */}
              {!isTemplateActive && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      isGenerating
                        ? "bg-neutral-700 text-neutral-500 cursor-wait"
                        : activeSession?.comfyApiWorkflow
                          ? "bg-sky-600 hover:bg-sky-500 text-white"
                          : "bg-neutral-700 hover:bg-neutral-600 text-neutral-300"
                    }`}
                    title={
                      activeSession?.comfyApiWorkflow
                        ? "Send to ComfyUI (Ctrl+Enter)"
                        : "Click to load an API workflow (Ctrl+Enter)"
                    }
                  >
                    {isGenerating ? "Sending..." : "Generate"}
                  </button>
                  <button
                    onClick={() => setShowComfySettingsModal(true)}
                    className="text-neutral-600 hover:text-neutral-400 transition-colors p-1"
                    title="ComfyUI connection settings"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                  </button>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-neutral-600">Weight</span>
                <button
                  onClick={() =>
                    setWeightMode((m) => (m === "combined" ? "none" : "combined"))
                  }
                  className={`w-7 h-[16px] rounded-full relative transition-colors ${
                    weightMode === "combined" ? "bg-sky-600" : "bg-neutral-600"
                  }`}
                >
                  <span
                    className={`absolute top-[2px] w-[12px] h-[12px] rounded-full bg-white transition-all ${
                      weightMode === "combined" ? "right-[2px]" : "left-[2px]"
                    }`}
                  />
                </button>
              </div>
              <button
                onClick={() => setShowHelp(true)}
                className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors"
              >
                Shortcuts &amp; Tips
              </button>
              <span
                className={`text-xs transition-colors duration-500 ${
                  savedFlash ? "text-green-500" : "text-neutral-600"
                }`}
              >
                {savedFlash ? "Saved ✓" : "Auto-saved locally"}
              </span>
            </div>
          </div>

          {activeSession && (
            <>
              <div
                className={
                  isTemplateActive ? "pointer-events-none opacity-60" : ""
                }
              >
                {/* 生成パラメータパネル */}
                {activeSession.comfyOverrides && (
                  <div className="mb-4 bg-neutral-800/50 rounded-lg px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                    {/* seed */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-neutral-500">seed</span>
                      {activeSession.comfyOverrides.seed === "random" ? (
                        <button
                          onClick={() => {
                            const current = activeSession.comfyOverrides;
                            if (!current) return;
                            handleUpdateOverrides({
                              seed: Math.floor(Math.random() * 2 ** 32),
                            });
                          }}
                          className="text-sky-500 hover:text-sky-400 transition-colors font-mono"
                          title="Click to fix to a specific seed"
                        >
                          🎲 random
                        </button>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span
                            className="text-neutral-200 font-mono cursor-text"
                            title="Click random to unfix"
                          >
                            {activeSession.comfyOverrides.seed}
                          </span>
                          <button
                            onClick={() =>
                              handleUpdateOverrides({ seed: "random" })
                            }
                            className="text-neutral-500 hover:text-sky-400 transition-colors"
                            title="Switch to random seed"
                          >
                            🎲
                          </button>
                        </div>
                      )}
                    </div>
                    <span className="text-neutral-700">|</span>
                    {/* cfg */}
                    <div className="flex items-center gap-1">
                      <span className="text-neutral-500">cfg</span>
                      <button
                        onClick={() =>
                          handleUpdateOverrides({
                            cfg: Math.max(
                              1,
                              Math.round(
                                (activeSession.comfyOverrides!.cfg - 0.5) * 10,
                              ) / 10,
                            ),
                          })
                        }
                        className="text-neutral-500 hover:text-neutral-300 transition-colors px-0.5"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        value={activeSession.comfyOverrides.cfg}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (!isNaN(v) && v >= 1 && v <= 30)
                            handleUpdateOverrides({ cfg: v });
                        }}
                        className="w-12 bg-transparent text-neutral-200 text-center font-mono border-b border-neutral-700 focus:border-neutral-400 focus:outline-none"
                        step={0.5}
                        min={1}
                        max={30}
                      />
                      <button
                        onClick={() =>
                          handleUpdateOverrides({
                            cfg: Math.min(
                              30,
                              Math.round(
                                (activeSession.comfyOverrides!.cfg + 0.5) * 10,
                              ) / 10,
                            ),
                          })
                        }
                        className="text-neutral-500 hover:text-neutral-300 transition-colors px-0.5"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-neutral-700">|</span>
                    {/* steps */}
                    <div className="flex items-center gap-1">
                      <span className="text-neutral-500">steps</span>
                      <button
                        onClick={() =>
                          handleUpdateOverrides({
                            steps: Math.max(
                              1,
                              activeSession.comfyOverrides!.steps - 1,
                            ),
                          })
                        }
                        className="text-neutral-500 hover:text-neutral-300 transition-colors px-0.5"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        value={activeSession.comfyOverrides.steps}
                        onChange={(e) => {
                          const v = parseInt(e.target.value);
                          if (!isNaN(v) && v >= 1 && v <= 150)
                            handleUpdateOverrides({ steps: v });
                        }}
                        className="w-10 bg-transparent text-neutral-200 text-center font-mono border-b border-neutral-700 focus:border-neutral-400 focus:outline-none"
                        step={1}
                        min={1}
                        max={150}
                      />
                      <button
                        onClick={() =>
                          handleUpdateOverrides({
                            steps: Math.min(
                              150,
                              activeSession.comfyOverrides!.steps + 1,
                            ),
                          })
                        }
                        className="text-neutral-500 hover:text-neutral-300 transition-colors px-0.5"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-neutral-700">|</span>
                    {/* sampler */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-neutral-500">sampler</span>
                      <select
                        value={activeSession.comfyOverrides.samplerName}
                        onChange={(e) =>
                          handleUpdateOverrides({ samplerName: e.target.value })
                        }
                        className="bg-neutral-800 text-neutral-200 font-mono text-xs border border-neutral-700 rounded px-1.5 py-0.5 focus:border-neutral-400 focus:outline-none cursor-pointer"
                      >
                        {[
                          "euler", "euler_ancestral", "euler_cfg_pp", "heun", "heunpp2",
                          "dpm_2", "dpm_2_ancestral", "lms", "dpm_fast", "dpm_adaptive",
                          "dpmpp_2s_ancestral", "dpmpp_sde", "dpmpp_sde_gpu",
                          "dpmpp_2m", "dpmpp_2m_sde", "dpmpp_2m_sde_gpu",
                          "dpmpp_3m_sde", "dpmpp_3m_sde_gpu",
                          "ddpm", "lcm", "ddim", "uni_pc", "uni_pc_bh2",
                        ].map((s) => (
                          <option key={s} value={s} className="bg-neutral-800 text-neutral-200">
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    <span className="text-neutral-700">|</span>
                    {/* scheduler */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-neutral-500">scheduler</span>
                      <select
                        value={activeSession.comfyOverrides.scheduler}
                        onChange={(e) =>
                          handleUpdateOverrides({ scheduler: e.target.value })
                        }
                        className="bg-neutral-800 text-neutral-200 font-mono text-xs border border-neutral-700 rounded px-1.5 py-0.5 focus:border-neutral-400 focus:outline-none cursor-pointer"
                      >
                        {[
                          "normal", "karras", "exponential", "sgm_uniform",
                          "simple", "ddim_uniform", "beta",
                        ].map((s) => (
                          <option key={s} value={s} className="bg-neutral-800 text-neutral-200">
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    {/* denoise (1.0以外の場合のみ表示) */}
                    {activeSession.comfyOverrides.denoise !== 1.0 && (
                      <>
                        <span className="text-neutral-700">|</span>
                        <div className="flex items-center gap-1">
                          <span className="text-neutral-500">denoise</span>
                          <input
                            type="number"
                            value={activeSession.comfyOverrides.denoise}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value);
                              if (!isNaN(v) && v >= 0 && v <= 1)
                                handleUpdateOverrides({ denoise: v });
                            }}
                            className="w-12 bg-transparent text-neutral-200 text-center font-mono border-b border-neutral-700 focus:border-neutral-400 focus:outline-none"
                            step={0.05}
                            min={0}
                            max={1}
                          />
                        </div>
                      </>
                    )}
                    {/* API workflow再読み込み */}
                    <span className="text-neutral-700">|</span>
                    <button
                      onClick={() => setShowApiWorkflowModal(true)}
                      className="text-neutral-500 hover:text-sky-400 transition-colors"
                      title="Load a different API workflow"
                    >
                      ↻ workflow
                    </button>
                  </div>
                )}
                <div className="space-y-4 mb-6">
                  <InputArea
                    label="Positive"
                    rows={5}
                    allText={positiveAllText}
                    copyText={positiveCopyText}
                    onSync={handleSyncPositive}
                  />
                  <InputArea
                    label="Negative"
                    rows={2}
                    labelColor="text-amber-800"
                    allText={negativeAllText}
                    copyText={negativeCopyText}
                    onSync={handleSyncNegative}
                  />
                </div>

                <div className="mb-6">
                  {/* ビュー切り替えトグル */}
                  <div className="flex items-center gap-1 mb-3">
                    <button
                      onClick={() => setViewMode("flat")}
                      className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                        viewMode === "flat"
                          ? "bg-neutral-700 text-neutral-200"
                          : "text-neutral-500 hover:text-neutral-300"
                      }`}
                      title="Flat view — original prompt order"
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M2 3h12M2 7h12M2 11h12" />
                      </svg>
                      Flat
                    </button>
                    <button
                      onClick={() => setViewMode("outline")}
                      className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                        viewMode === "outline"
                          ? "bg-neutral-700 text-neutral-200"
                          : "text-neutral-500 hover:text-neutral-300"
                      }`}
                      title="Outline view — grouped by category"
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M2 2h5v5H2zM9 3h5M9 6h4M2 9h5v5H2zM9 10h5M9 13h4" />
                      </svg>
                      Outline
                    </button>
                    <div className="flex-1" />
                    <button
                      onClick={() => {
                        if (!activeSession) return;
                        const allTexts = [
                          ...activeSession.positiveLines,
                          ...activeSession.negativeLines,
                        ].map((l) => l.text);
                        const unique = [...new Set(allTexts.map((t) => normalizeForLookup(t)))];
                        const unannotated = unique.filter((key) => !annotations[key]);
                        const jsonEntries = unannotated.map((key) => ({
                          tag: key,
                          description: "",
                          group: defaultGroups[key] ?? "",
                          ...(negativeTags[key] ? { negative: true } : {}),
                        }));
                        setBulkAnnotationText(
                          JSON.stringify(jsonEntries, null, 2),
                        );
                        setShowBulkAnnotation(true);
                      }}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
                      title="Bulk add notes for unannotated prompts"
                    >
                      📝 Bulk notes
                    </button>
                  </div>

                  <PromptEditor
                    positiveLines={activeSession.positiveLines}
                    negativeLines={activeSession.negativeLines}
                    positiveGroups={activeSession.positiveGroups}
                    negativeGroups={activeSession.negativeGroups}
                    weightMode={weightMode}
                    viewMode={viewMode}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                    onUpdate={handleUpdate}
                    onAdd={handleAdd}
                    onDuplicate={handleDuplicate}
                    onReorder={handleReorder}
                    onWeightChange={handleWeightChange}
                    onWeightSet={handleWeightSet}
                    onSetGroup={handleSetGroup}
                    onBulkToggle={handleSectionBulkToggle}
                    onUngroup={handleUngroup}
                    onSetLineGroup={handleSetLineGroup}
                    onReplaceGroup={handleReplaceGroup}
                    onReplaceSelection={handleReplaceSelection}
                    annotations={annotations}
                    onSetAnnotation={handleSetAnnotation}
                  />
                </div>

                <MemoBox
                  memo={activeSession.memo}
                  onMemoChange={handleMemoChange}
                />

                <GenerationHistory
                  entries={activeSession.generationHistory ?? []}
                  comfyConnected={!!getActiveConnection(comfySettings)}
                  onClear={() => {
                    updateActiveSession((s) => ({
                      ...s,
                      generationHistory: [],
                    }));
                  }}
                />
              </div>

              {isTemplateActive && (
                <div className="mt-6 text-center">
                  <button
                    onClick={() => handleOpenFromTemplate(activeSession.id)}
                    className="px-4 py-2 text-sm bg-amber-800/30 hover:bg-amber-800/50 text-amber-300 rounded-lg transition-colors"
                  >
                    Create new session from this template
                  </button>
                </div>
              )}
            </>
          )}
          </>
          )}
        </div>
      </div>

      {/* ヘルプオーバーレイ */}
      {showHelp &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
            }}
            onClick={() => setShowHelp(false)}
          >
            <div
              style={{
                backgroundColor: "#262626",
                border: "1px solid #404040",
                borderRadius: "8px",
                padding: "24px",
                maxWidth: "384px",
                width: "100%",
                margin: "0 16px",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-neutral-200">
                  Keyboard shortcuts
                </h2>
                <button
                  onClick={() => setShowHelp(false)}
                  className="text-neutral-500 hover:text-neutral-300 transition-colors"
                >
                  ×
                </button>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-neutral-400">Duplicate line</span>
                  <kbd className="text-neutral-300 bg-neutral-700 px-1.5 py-0.5 rounded text-xs font-mono">
                    Ctrl+D
                  </kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Confirm edit</span>
                  <kbd className="text-neutral-300 bg-neutral-700 px-1.5 py-0.5 rounded text-xs font-mono">
                    Enter
                  </kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Cancel edit</span>
                  <kbd className="text-neutral-300 bg-neutral-700 px-1.5 py-0.5 rounded text-xs font-mono">
                    Esc
                  </kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Show this help</span>
                  <kbd className="text-neutral-300 bg-neutral-700 px-1.5 py-0.5 rounded text-xs font-mono">
                    ?
                  </kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Generate (ComfyUI)</span>
                  <kbd className="text-neutral-300 bg-neutral-700 px-1.5 py-0.5 rounded text-xs font-mono">
                    Ctrl+Enter
                  </kbd>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-neutral-700 space-y-1.5 text-xs text-neutral-500">
                <p>Click a line to edit it</p>
                <p>Drag the handle to reorder</p>
                <p>Toggle to include / exclude from output</p>
                <p>Changes are saved automatically</p>
              </div>
            </div>
          </div>,
          document.body
        )}
      {/* API Workflow読み込みモーダル */}
      {showApiWorkflowModal &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
            }}
            onClick={() => setShowApiWorkflowModal(false)}
          >
            <div
              style={{
                backgroundColor: "#262626",
                border: "1px solid #404040",
                borderRadius: "8px",
                padding: "24px",
                maxWidth: "420px",
                width: "100%",
                margin: "0 16px",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-neutral-200">
                  Load API Workflow
                </h2>
                <button
                  onClick={() => setShowApiWorkflowModal(false)}
                  className="text-neutral-500 hover:text-neutral-300 transition-colors"
                >
                  ×
                </button>
              </div>
              <p className="text-xs text-neutral-400 mb-4">
                To generate images from Siglane, import a ComfyUI workflow saved in API format.
              </p>
              <div className="bg-neutral-800 border border-neutral-700 border-dashed rounded-lg p-6 text-center mb-4">
                <input
                  ref={apiWorkflowFileRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImportApiWorkflow(file);
                    e.target.value = "";
                  }}
                />
                <button
                  onClick={() => apiWorkflowFileRef.current?.click()}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-sm rounded transition-colors"
                >
                  Select API workflow JSON
                </button>
                <p className="text-[11px] text-neutral-500 mt-2">
                  .json file saved with &quot;Save (API Format)&quot;
                </p>
              </div>
              <div className="bg-neutral-800/50 rounded p-3 space-y-1.5">
                <p className="text-[11px] text-neutral-500 font-medium">
                  How to get API format:
                </p>
                <p className="text-[11px] text-neutral-500">
                  1. In ComfyUI, open Settings → Enable Dev mode options
                </p>
                <p className="text-[11px] text-neutral-500">
                  2. Click &quot;Save (API Format)&quot; in the menu
                </p>
                <p className="text-[11px] text-neutral-500">
                  3. Import the saved .json file here
                </p>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ComfyUI接続設定モーダル */}
      {showComfySettingsModal &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
            }}
            onClick={() => setShowComfySettingsModal(false)}
          >
            <div
              style={{
                backgroundColor: "#262626",
                border: "1px solid #404040",
                borderRadius: "8px",
                padding: "24px",
                maxWidth: "420px",
                width: "100%",
                margin: "0 16px",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-neutral-200">
                  ComfyUI Connection
                </h2>
                <button
                  onClick={() => setShowComfySettingsModal(false)}
                  className="text-neutral-500 hover:text-neutral-300 transition-colors"
                >
                  ×
                </button>
              </div>
              {(() => {
                const conn = getActiveConnection(comfySettings);
                return (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">
                        Server URL
                      </label>
                      <input
                        type="text"
                        defaultValue={conn?.url ?? "http://127.0.0.1:8188"}
                        onBlur={(e) => {
                          const newUrl = e.target.value.trim();
                          if (!newUrl || !conn) return;
                          handleSaveComfySettings({
                            ...comfySettings,
                            connections: comfySettings.connections.map((c) =>
                              c.id === conn.id ? { ...c, url: newUrl } : c,
                            ),
                          });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        }}
                        className="w-full bg-neutral-800 border border-neutral-600 rounded px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-neutral-400 font-mono"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <button
                        onClick={async () => {
                          if (!conn) return;
                          const result = await testConnection(conn);
                          setGenerateToast(
                            result.ok
                              ? { message: "Connected to ComfyUI!", type: "success" }
                              : { message: `Connection failed: ${result.error}`, type: "error" },
                          );
                        }}
                        className="text-xs text-sky-500 hover:text-sky-400 transition-colors"
                      >
                        Test connection
                      </button>
                      <p className="text-[11px] text-neutral-600">
                        ComfyUI must be started with --enable-cors-header
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>,
          document.body
        )}

      {/* 一括注釈モーダル */}
      {showBulkAnnotation &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
            }}
            onClick={() => setShowBulkAnnotation(false)}
          >
            <div
              style={{
                backgroundColor: "#262626",
                border: "1px solid #404040",
                borderRadius: "8px",
                padding: "24px",
                maxWidth: "520px",
                width: "100%",
                margin: "0 16px",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-neutral-200">
                  Bulk Notes
                </h2>
                <button
                  onClick={() => setShowBulkAnnotation(false)}
                  className="text-neutral-500 hover:text-neutral-300 transition-colors"
                >
                  ×
                </button>
              </div>
              <p className="text-xs text-neutral-400 mb-3">
                Copy the list below, paste into an AI to get descriptions, then paste the result back and click Register.
                Format: <code className="text-neutral-300">JSON array</code>
                <br />
                <span className="text-neutral-500">Each entry: <code className="text-neutral-400">{`{"tag", "description", "group", "negative"}`}</code>. <code className="text-neutral-400">negative</code> is optional (default false).</span>
              </p>
              {/* LLM Auto-fill */}
              <div className="flex items-center gap-2 mb-3">
                <button
                  onClick={async () => {
                    setIsTranslating(true);
                    const result = await translateTags(llmSettings, bulkAnnotationText);
                    setIsTranslating(false);
                    if (result.ok) {
                      setBulkAnnotationText(result.result);
                      setGenerateToast({ message: "LLM auto-fill complete", type: "success" });
                    } else {
                      setGenerateToast({ message: result.error, type: "error" });
                    }
                  }}
                  disabled={isTranslating || !bulkAnnotationText.trim()}
                  className={`px-3 py-1.5 text-xs rounded transition-colors ${
                    isTranslating
                      ? "bg-neutral-700 text-neutral-500 cursor-wait"
                      : "bg-sky-600 hover:bg-sky-500 text-white"
                  } disabled:opacity-40`}
                >
                  {isTranslating ? "Translating..." : "Auto-fill with LLM"}
                </button>
                <button
                  onClick={() => setShowLlmSettingsModal(true)}
                  className="text-neutral-600 hover:text-neutral-400 transition-colors p-1"
                  title="LLM connection settings"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </button>
                <span className="text-[10px] text-neutral-600">
                  {llmSettings.connection.model} @ {llmSettings.connection.url.replace(/https?:\/\//, "").replace(/\/v1\/chat\/completions\/?$/, "")}
                </span>
              </div>
              <textarea
                value={bulkAnnotationText}
                onChange={(e) => setBulkAnnotationText(e.target.value)}
                rows={14}
                className="w-full bg-neutral-900 border border-neutral-600 rounded-lg px-3 py-2 text-xs font-mono text-neutral-200 focus:outline-none focus:border-neutral-400 resize-y"
                placeholder={'[\n  {"tag": "masterpiece", "description": "highest quality tag", "group": "Quality"},\n  {"tag": "1girl", "description": "one female character", "group": "Character"},\n  {"tag": "worst quality", "description": "low quality exclusion", "group": "Quality", "negative": true}\n]'}
              />
              <div className="flex items-center justify-between mt-3">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(bulkAnnotationText);
                    setGenerateToast({ message: "Copied to clipboard", type: "success" });
                  }}
                  className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
                >
                  Copy to clipboard
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowBulkAnnotation(false)}
                    className="px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      let entries: Array<{
                        tag: string;
                        description?: string;
                        group?: string;
                        negative?: boolean;
                      }>;
                      try {
                        entries = JSON.parse(bulkAnnotationText);
                        if (!Array.isArray(entries)) {
                          setGenerateToast({ message: "Invalid JSON: expected an array", type: "error" });
                          return;
                        }
                      } catch {
                        setGenerateToast({ message: "Invalid JSON format", type: "error" });
                        return;
                      }

                      // normalize keys
                      const parsed = entries
                        .filter((e) => e.tag && typeof e.tag === "string")
                        .map((e) => ({
                          key: e.tag.trim().toLowerCase(),
                          desc: e.description?.trim() || null,
                          group: e.group?.trim() || null,
                          negative: e.negative === true,
                        }));

                      let annotationCount = 0;
                      let groupCount = 0;
                      let negativeCount = 0;

                      if (parsed.length > 0) {
                        // 注釈を登録
                        setAnnotations((prev) => {
                          const updated = { ...prev };
                          for (const { key, desc } of parsed) {
                            if (desc) {
                              updated[key] = desc;
                              annotationCount++;
                            }
                          }
                          if (annotationCount > 0) saveAnnotations(updated);
                          return updated;
                        });

                        // デフォルトグループを登録
                        const newDefaults: Record<string, string> = {};
                        for (const { key, group } of parsed) {
                          if (group) {
                            newDefaults[key] = group;
                            groupCount++;
                          }
                        }
                        if (groupCount > 0) {
                          setDefaultGroups((prev) => {
                            const updated = { ...prev, ...newDefaults };
                            saveDefaultGroups(updated);
                            return updated;
                          });

                          // 現在のセッションにデフォルトグループを即時適用
                          updateActiveSession((s) => {
                            const applyDefaults = (
                              lines: PromptLine[],
                              groups: PromptGroup[] | undefined,
                              dg: Record<string, string>,
                            ) => {
                              const gs = [...(groups ?? [])];
                              const updated = lines.map((l) => {
                                if (l.groupId) return l;
                                const label = dg[normalizeForLookup(l.text)];
                                if (!label) return l;
                                let g = gs.find((g) => g.label === label);
                                if (!g) {
                                  g = { id: crypto.randomUUID(), label, order: gs.length };
                                  gs.push(g);
                                }
                                return { ...l, groupId: g.id };
                              });
                              return { lines: updated, groups: gs };
                            };

                            const pos = applyDefaults(
                              s.positiveLines,
                              s.positiveGroups,
                              newDefaults,
                            );
                            const neg = applyDefaults(
                              s.negativeLines,
                              s.negativeGroups,
                              newDefaults,
                            );
                            return {
                              ...s,
                              positiveLines: pos.lines,
                              positiveGroups: pos.groups,
                              negativeLines: neg.lines,
                              negativeGroups: neg.groups,
                            };
                          });
                        }

                        // ネガティブタグを登録
                        const newNegatives: NegativeTags = {};
                        for (const { key, negative } of parsed) {
                          if (negative) {
                            newNegatives[key] = true;
                            negativeCount++;
                          }
                        }
                        if (negativeCount > 0) {
                          setNegativeTags((prev) => {
                            const updated = { ...prev, ...newNegatives };
                            saveNegativeTags(updated);
                            return updated;
                          });
                        }
                      }

                      setShowBulkAnnotation(false);
                      if (annotationCount > 0 || groupCount > 0 || negativeCount > 0) {
                        const parts: string[] = [];
                        if (annotationCount > 0)
                          parts.push(`${annotationCount} annotations`);
                        if (groupCount > 0)
                          parts.push(`${groupCount} default groups`);
                        if (negativeCount > 0)
                          parts.push(`${negativeCount} negative tags`);
                        setGenerateToast({
                          message: `Registered ${parts.join(" + ")}`,
                          type: "success",
                        });
                      }
                    }}
                    className="px-3 py-1.5 text-xs bg-sky-600 hover:bg-sky-500 text-white rounded transition-colors"
                  >
                    Register
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* LLM接続設定モーダル */}
      {showLlmSettingsModal &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10001,
            }}
            onClick={() => setShowLlmSettingsModal(false)}
          >
            <div
              style={{
                backgroundColor: "#262626",
                border: "1px solid #404040",
                borderRadius: "8px",
                padding: "24px",
                maxWidth: "480px",
                width: "100%",
                margin: "0 16px",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-neutral-200">
                  LLM Connection
                </h2>
                <button
                  onClick={() => setShowLlmSettingsModal(false)}
                  className="text-neutral-500 hover:text-neutral-300 transition-colors"
                >
                  ×
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">
                    API URL
                  </label>
                  <input
                    type="text"
                    defaultValue={llmSettings.connection.url}
                    onBlur={(e) => {
                      const updated = {
                        ...llmSettings,
                        connection: { ...llmSettings.connection, url: e.target.value.trim() },
                      };
                      setLlmSettings(updated);
                      saveLlmSettings(updated);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                    className="w-full bg-neutral-800 border border-neutral-600 rounded px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-neutral-400 font-mono"
                    placeholder="http://localhost:11434/v1/chat/completions"
                  />
                  <p className="text-[10px] text-neutral-600 mt-1">
                    Ollama: localhost:11434 / LM Studio: localhost:1234 / OpenAI: api.openai.com
                  </p>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-neutral-400 mb-1">
                      Model
                    </label>
                    <input
                      type="text"
                      defaultValue={llmSettings.connection.model}
                      onBlur={(e) => {
                        const updated = {
                          ...llmSettings,
                          connection: { ...llmSettings.connection, model: e.target.value.trim() },
                        };
                        setLlmSettings(updated);
                        saveLlmSettings(updated);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      }}
                      className="w-full bg-neutral-800 border border-neutral-600 rounded px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-neutral-400 font-mono"
                      placeholder="gemma2"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-neutral-400 mb-1">
                      API Key <span className="text-neutral-600">(optional)</span>
                    </label>
                    <input
                      type="password"
                      defaultValue={llmSettings.connection.apiKey}
                      onBlur={(e) => {
                        const updated = {
                          ...llmSettings,
                          connection: { ...llmSettings.connection, apiKey: e.target.value.trim() },
                        };
                        setLlmSettings(updated);
                        saveLlmSettings(updated);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      }}
                      className="w-full bg-neutral-800 border border-neutral-600 rounded px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-neutral-400 font-mono"
                      placeholder="sk-... (blank for local)"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">
                    System prompt
                  </label>
                  <textarea
                    defaultValue={llmSettings.systemPrompt}
                    onBlur={(e) => {
                      const updated = {
                        ...llmSettings,
                        systemPrompt: e.target.value,
                      };
                      setLlmSettings(updated);
                      saveLlmSettings(updated);
                    }}
                    rows={6}
                    className="w-full bg-neutral-800 border border-neutral-600 rounded px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-neutral-400 font-mono resize-y"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <button
                    onClick={async () => {
                      const result = await testLlmConnection(llmSettings.connection);
                      setGenerateToast(
                        result.ok
                          ? { message: "Connected to LLM!", type: "success" }
                          : { message: `Connection failed: ${result.error}`, type: "error" },
                      );
                    }}
                    className="text-xs text-sky-500 hover:text-sky-400 transition-colors"
                  >
                    Test connection
                  </button>
                  <button
                    onClick={() => setShowLlmSettingsModal(false)}
                    className="px-3 py-1.5 text-xs bg-neutral-700 hover:bg-neutral-600 text-neutral-200 rounded transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* トースト通知 */}
      {generateToast &&
        createPortal(
          <div
            style={{
              position: "fixed",
              bottom: "24px",
              right: "24px",
              zIndex: 10000,
            }}
          >
            <div
              className={`px-4 py-2.5 rounded-lg text-sm shadow-lg border ${
                generateToast.type === "success"
                  ? "bg-green-900/80 border-green-700 text-green-200"
                  : "bg-red-900/80 border-red-700 text-red-200"
              }`}
              style={{ maxWidth: "360px" }}
            >
              {generateToast.message}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
