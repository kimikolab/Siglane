"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  AppState,
  Session,
  Folder,
  SiglaneState,
  PromptLine,
  parsePrompt,
  joinPromptLines,
  joinAllPromptLines,
  createSession,
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
import SessionSidebar from "@/components/SessionSidebar";
import { WeightMode } from "@/components/PromptLineItem";

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
    updateActiveSession((s) => ({ ...s, positiveLines: parsePrompt(text) }));
  };

  const handleSyncNegative = (text: string) => {
    updateActiveSession((s) => ({ ...s, negativeLines: parsePrompt(text) }));
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
        lines.splice(index, 1, ...parsed);
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
      }
    };
    window.addEventListener("keydown", handleGlobalKey);
    return () => window.removeEventListener("keydown", handleGlobalKey);
  }, []);

  const isTemplateActive = activeSession?.isTemplate ?? false;

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
      />

      {/* メインエディタ */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6">
          {/* ステータスバー */}
          <div className="flex items-start justify-between mb-5">
            {/* 左: セッション名 + テンプレートバッジ */}
            <div className="min-w-0 flex-1">
              {activeSession && (
                <div className="flex flex-col gap-1">
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
                </div>
              )}
            </div>

            {/* 右: 重みモード + ショートカット + 保存状態 */}
            <div className="flex items-center gap-4 flex-shrink-0 pt-1">
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
                  <PromptEditor
                    positiveLines={activeSession.positiveLines}
                    negativeLines={activeSession.negativeLines}
                    weightMode={weightMode}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                    onUpdate={handleUpdate}
                    onAdd={handleAdd}
                    onDuplicate={handleDuplicate}
                    onReorder={handleReorder}
                    onWeightChange={handleWeightChange}
                    onWeightSet={handleWeightSet}
                  />
                </div>

                <MemoBox
                  memo={activeSession.memo}
                  onMemoChange={handleMemoChange}
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
    </div>
  );
}
