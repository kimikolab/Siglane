"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Session, Folder } from "@/types";

interface SessionSidebarProps {
  sessions: Session[];
  folders: Folder[];
  activeSessionId: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onSelectSession: (id: string) => void;
  onNewSession: (folderId?: string | null) => void;
  onDuplicateSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, newLabel: string) => void;
  onToggleTemplate: (id: string) => void;
  onOpenFromTemplate: (id: string) => void;
  onMoveSession: (sessionId: string, folderId: string | null) => void;
  onNewFolder: (parentId: string | null) => void;
  onRenameFolder: (id: string, newLabel: string) => void;
  onDeleteFolder: (id: string) => void;
}

// --- コンテキストメニュー（Portal描画） ---
interface MenuAction {
  label: string;
  onClick: () => void;
  danger?: boolean;
  submenu?: { label: string; onClick: () => void }[];
}

function ContextMenu({
  actions,
  anchorRect,
  onClose,
}: {
  actions: MenuAction[];
  anchorRect: DOMRect;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [openSubmenuIdx, setOpenSubmenuIdx] = useState<number | null>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const top = anchorRect.bottom + 4;
  const left = Math.max(8, anchorRect.left - 120);

  return createPortal(
    <div
      ref={menuRef}
      style={{ position: "fixed", top, left, zIndex: 9999 }}
      className="bg-neutral-800 border border-neutral-600 rounded-lg shadow-2xl py-1.5 min-w-[170px]"
    >
      {actions.map((action, i) => {
        if (action.label === "---") {
          return (
            <div key={i} className="my-1 h-px bg-neutral-700 mx-3" />
          );
        }

        if (action.submenu) {
          return (
            <div
              key={i}
              className="relative"
              onMouseEnter={() => setOpenSubmenuIdx(i)}
              onMouseLeave={() => setOpenSubmenuIdx(null)}
            >
              <button className="w-full text-left px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-700 transition-colors flex items-center justify-between">
                {action.label}
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M6 3l5 5-5 5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              {openSubmenuIdx === i && (
                <div
                  className="absolute left-full top-0 ml-1 bg-neutral-800 border border-neutral-600 rounded-lg shadow-2xl py-1.5 min-w-[140px]"
                >
                  {action.submenu.map((sub, si) => (
                    <button
                      key={si}
                      onClick={() => {
                        sub.onClick();
                        onClose();
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-700 transition-colors"
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        }

        return (
          <button
            key={i}
            onClick={() => {
              action.onClick();
              onClose();
            }}
            className={`w-full text-left px-4 py-2 text-sm transition-colors ${
              action.danger
                ? "text-red-400 hover:bg-neutral-700"
                : "text-neutral-200 hover:bg-neutral-700"
            }`}
          >
            {action.label}
          </button>
        );
      })}
    </div>,
    document.body,
  );
}

// --- メインコンポーネント ---
export default function SessionSidebar({
  sessions,
  folders,
  activeSessionId,
  collapsed,
  onToggleCollapse,
  onSelectSession,
  onNewSession,
  onDuplicateSession,
  onDeleteSession,
  onRenameSession,
  onToggleTemplate,
  onOpenFromTemplate,
  onMoveSession,
  onNewFolder,
  onRenameFolder,
  onDeleteFolder,
}: SessionSidebarProps) {
  const [menuOpen, setMenuOpen] = useState<{
    type: "session" | "folder";
    id: string;
    rect: DOMRect;
  } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renamingType, setRenamingType] = useState<"session" | "folder">("session");
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());

  const closeMenu = useCallback(() => setMenuOpen(null), []);

  const toggleFolderCollapse = (folderId: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  // --- ヘルパー ---
  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}d ago`;
    return d.toLocaleDateString();
  };

  const startRename = (id: string, label: string, type: "session" | "folder") => {
    setRenamingId(id);
    setRenameValue(label);
    setRenamingType(type);
  };

  const commitRename = () => {
    if (renamingId && renameValue.trim()) {
      if (renamingType === "session") {
        onRenameSession(renamingId, renameValue.trim());
      } else {
        onRenameFolder(renamingId, renameValue.trim());
      }
    }
    setRenamingId(null);
  };

  const openMenu = (
    type: "session" | "folder",
    id: string,
    buttonEl: HTMLElement,
  ) => {
    const rect = buttonEl.getBoundingClientRect();
    setMenuOpen({ type, id, rect });
  };

  // --- データ整理 ---
  const templates = sessions
    .filter((s) => s.isTemplate)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const regularSessions = sessions.filter((s) => !s.isTemplate);

  const rootFolders = folders
    .filter((f) => f.parentId === null)
    .sort((a, b) => a.order - b.order);

  const getSubfolders = (parentId: string) =>
    folders
      .filter((f) => f.parentId === parentId)
      .sort((a, b) => a.order - b.order);

  const getSessionsInFolder = (folderId: string) =>
    regularSessions
      .filter((s) => s.folderId === folderId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const unfiled = regularSessions
    .filter((s) => s.folderId === null || s.folderId === undefined)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  // フォルダ配下の全セッション数（サブフォルダ含む）
  const countSessionsInTree = (folderId: string): number => {
    let count = getSessionsInFolder(folderId).length;
    for (const sub of getSubfolders(folderId)) {
      count += getSessionsInFolder(sub.id).length;
    }
    return count;
  };

  // Move to メニュー用: 移動先候補を構築
  const buildMoveTargets = (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return [];

    const targets: { label: string; onClick: () => void }[] = [];

    if (session.folderId !== null) {
      targets.push({
        label: "Unfiled",
        onClick: () => onMoveSession(sessionId, null),
      });
    }

    for (const root of rootFolders) {
      if (session.folderId !== root.id) {
        targets.push({
          label: root.label,
          onClick: () => onMoveSession(sessionId, root.id),
        });
      }
      for (const sub of getSubfolders(root.id)) {
        if (session.folderId !== sub.id) {
          targets.push({
            label: `${root.label} / ${sub.label}`,
            onClick: () => onMoveSession(sessionId, sub.id),
          });
        }
      }
    }

    return targets;
  };

  // --- セッションアイテム ---
  const handleSessionClick = (session: Session) => {
    if (session.isTemplate) {
      onOpenFromTemplate(session.id);
    } else {
      onSelectSession(session.id);
    }
  };

  const renderSessionItem = (session: Session, indent: number = 0) => {
    const isActive = session.id === activeSessionId;
    const isRenaming = renamingId === session.id && renamingType === "session";

    return (
      <div
        key={session.id}
        className={`group rounded-lg cursor-pointer transition-colors ${
          isActive
            ? "bg-neutral-700/60 border border-neutral-600/60"
            : "hover:bg-neutral-800/80 border border-transparent"
        }`}
        style={{ marginLeft: indent, paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8 }}
        onClick={() => !isRenaming && handleSessionClick(session)}
      >
        <div className="flex items-center gap-2 min-w-0">
          {session.isTemplate && (
            <span className="flex-shrink-0 text-amber-500" title="Template">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1l1.5 4.5H14l-3.5 2.5L12 13 8 10l-4 3 1.5-5L2 5.5h4.5z" />
              </svg>
            </span>
          )}

          <div className="flex-1 min-w-0">
            {isRenaming ? (
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") setRenamingId(null);
                }}
                autoFocus
                className="w-full bg-neutral-900 border border-neutral-500 rounded px-2 py-0.5 text-sm text-neutral-200 focus:outline-none focus:border-neutral-400"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <div className="truncate text-sm text-neutral-200">
                {session.label}
              </div>
            )}
            <div className="text-[11px] text-neutral-500 mt-0.5">
              {formatDate(session.updatedAt)}
            </div>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              if (menuOpen?.type === "session" && menuOpen.id === session.id) {
                closeMenu();
              } else {
                openMenu("session", session.id, e.currentTarget);
              }
            }}
            className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-neutral-200 transition-all p-1 rounded hover:bg-neutral-700"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="8" cy="3" r="1.5" />
              <circle cx="8" cy="8" r="1.5" />
              <circle cx="8" cy="13" r="1.5" />
            </svg>
          </button>
        </div>
      </div>
    );
  };

  // --- フォルダヘッダー ---
  const renderFolderHeader = (
    folder: Folder,
    indent: number,
    isCollapsed: boolean,
    sessionCount: number,
    isSubfolder: boolean,
  ) => {
    const isRenaming = renamingId === folder.id && renamingType === "folder";

    return (
      <div
        key={folder.id}
        className={`group flex items-center gap-1.5 rounded-lg cursor-pointer transition-colors hover:bg-neutral-800/60 ${
          isSubfolder ? "py-1.5" : "py-2.5 border-l-2 border-amber-700/60"
        }`}
        style={{ marginLeft: indent, paddingLeft: isSubfolder ? 12 : 10, paddingRight: 12 }}
        onClick={() => !isRenaming && toggleFolderCollapse(folder.id)}
      >
        {!isSubfolder && (
          <span className="text-amber-600/80 flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="M2 4.5A1.5 1.5 0 013.5 3H6l1.5 1.5h5A1.5 1.5 0 0114 6v5.5a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 11.5v-7z"
                fill="currentColor"
                opacity="0.3"
                stroke="currentColor"
                strokeWidth="0.8"
              />
            </svg>
          </span>
        )}

        <span className="text-neutral-500 flex-shrink-0 w-4 text-center text-[11px]">
          {isCollapsed ? "▶" : "▼"}
        </span>

        <div className="flex-1 min-w-0">
          {isRenaming ? (
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") setRenamingId(null);
              }}
              autoFocus
              className="w-full bg-neutral-900 border border-neutral-500 rounded px-2 py-0.5 text-sm text-neutral-200 focus:outline-none focus:border-neutral-400"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className={`truncate block ${isSubfolder ? "text-xs text-neutral-400" : "text-sm text-neutral-100 font-medium"}`}>
              {folder.label}
            </span>
          )}
        </div>

        {isCollapsed && sessionCount > 0 && (
          <span className="text-[10px] text-neutral-600 flex-shrink-0">
            {sessionCount}
          </span>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            if (menuOpen?.type === "folder" && menuOpen.id === folder.id) {
              closeMenu();
            } else {
              openMenu("folder", folder.id, e.currentTarget);
            }
          }}
          className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-neutral-200 transition-all p-1 rounded hover:bg-neutral-700"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="8" cy="3" r="1.5" />
            <circle cx="8" cy="8" r="1.5" />
            <circle cx="8" cy="13" r="1.5" />
          </svg>
        </button>
      </div>
    );
  };

  // --- フォルダツリー描画 ---
  const renderFolderTree = (folder: Folder, indent: number = 0) => {
    const isCollapsed = collapsedFolders.has(folder.id);
    const subfolders = getSubfolders(folder.id);
    const directSessions = getSessionsInFolder(folder.id);
    const isSubfolder = folder.parentId !== null;
    const totalCount = isSubfolder
      ? directSessions.length
      : countSessionsInTree(folder.id);

    return (
      <div key={folder.id}>
        {renderFolderHeader(folder, indent, isCollapsed, totalCount, isSubfolder)}

        {!isCollapsed && (
          <>
            {subfolders.map((sub) =>
              renderFolderTree(sub, indent + 16),
            )}
            {directSessions.map((s) =>
              renderSessionItem(s, indent + 16),
            )}
          </>
        )}
      </div>
    );
  };

  // --- メニューアクション構築 ---
  const buildSessionMenuActions = (sessionId: string): MenuAction[] => {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return [];

    const moveTargets = buildMoveTargets(sessionId);
    const actions: MenuAction[] = [
      {
        label: "Rename",
        onClick: () => startRename(session.id, session.label, "session"),
      },
      {
        label: "Duplicate",
        onClick: () => onDuplicateSession(session.id),
      },
      {
        label: session.isTemplate ? "Unlock (remove template)" : "Lock as template",
        onClick: () => onToggleTemplate(session.id),
      },
    ];

    if (moveTargets.length > 0) {
      actions.push({
        label: "Move to",
        onClick: () => {},
        submenu: moveTargets,
      });
    }

    actions.push({ label: "---", onClick: () => {} });
    actions.push({
      label: "Delete",
      onClick: () => {
        if (window.confirm(`Delete "${session.label}"?`)) {
          onDeleteSession(session.id);
        }
      },
      danger: true,
    });

    return actions;
  };

  const buildFolderMenuActions = (folderId: string): MenuAction[] => {
    const folder = folders.find((f) => f.id === folderId);
    if (!folder) return [];

    const actions: MenuAction[] = [
      {
        label: "Rename",
        onClick: () => startRename(folder.id, folder.label, "folder"),
      },
      {
        label: "New session here",
        onClick: () => onNewSession(folder.id),
      },
    ];

    if (folder.parentId === null) {
      actions.push({
        label: "New subfolder",
        onClick: () => onNewFolder(folder.id),
      });
    }

    actions.push({ label: "---", onClick: () => {} });
    actions.push({
      label: "Delete folder",
      onClick: () => {
        const subCount = folders.filter((f) => f.parentId === folder.id).length;
        const sessionCount = sessions.filter(
          (s) =>
            !s.isTemplate &&
            (s.folderId === folder.id ||
              folders.some(
                (f) => f.parentId === folder.id && f.id === s.folderId,
              )),
        ).length;
        const details = [
          subCount > 0 ? `${subCount} subfolder(s)` : "",
          sessionCount > 0 ? `${sessionCount} session(s)` : "",
        ]
          .filter(Boolean)
          .join(" and ");
        const msg = details
          ? `Delete "${folder.label}"? ${details} inside will be moved to Unfiled.`
          : `Delete "${folder.label}"?`;
        if (window.confirm(msg)) {
          onDeleteFolder(folder.id);
        }
      },
      danger: true,
    });

    return actions;
  };

  // --- 折りたたみ時 ---
  if (collapsed) {
    return (
      <div className="flex flex-col items-center pt-6 gap-4 w-12 bg-neutral-950 border-r-2 border-neutral-700">
        <button
          onClick={onToggleCollapse}
          className="text-neutral-400 hover:text-neutral-200 transition-colors p-1.5"
          title="Expand sidebar"
        >
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
            <path
              d="M6 3l5 5-5 5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          onClick={() => onNewFolder(null)}
          className="text-neutral-400 hover:text-neutral-200 transition-colors p-1.5"
          title="New folder"
        >
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
            <path
              d="M2 4.5A1.5 1.5 0 013.5 3H6l1.5 1.5h5A1.5 1.5 0 0114 6v5.5a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 11.5v-7z"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            <path
              d="M8 7v4M6 9h4"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <button
          onClick={() => onNewSession(null)}
          className="text-neutral-400 hover:text-neutral-200 transition-colors p-1.5"
          title="New session"
        >
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 3v10M3 8h10"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    );
  }

  const menuActions =
    menuOpen?.type === "session"
      ? buildSessionMenuActions(menuOpen.id)
      : menuOpen?.type === "folder"
        ? buildFolderMenuActions(menuOpen.id)
        : [];

  return (
    <>
      <div className="flex flex-col w-72 bg-neutral-950 border-r-2 border-neutral-700 h-full">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <span className="text-lg font-semibold text-neutral-100 tracking-tight">
            Siglane
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onNewFolder(null)}
              className="text-neutral-400 hover:text-neutral-200 transition-colors p-2 rounded-lg hover:bg-neutral-800"
              title="New folder"
            >
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                <path
                  d="M2 4.5A1.5 1.5 0 013.5 3H6l1.5 1.5h5A1.5 1.5 0 0114 6v5.5a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 11.5v-7z"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
                <path
                  d="M8 7v4M6 9h4"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <button
              onClick={() => onNewSession(null)}
              className="text-neutral-400 hover:text-neutral-200 transition-colors p-2 rounded-lg hover:bg-neutral-800"
              title="New session"
            >
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                <path
                  d="M8 3v10M3 8h10"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <button
              onClick={onToggleCollapse}
              className="text-neutral-400 hover:text-neutral-200 transition-colors p-2 rounded-lg hover:bg-neutral-800"
              title="Collapse sidebar"
            >
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                <path
                  d="M10 3l-5 5 5 5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* リスト */}
        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-0.5 sidebar-scroll">
          {/* テンプレート */}
          {templates.length > 0 && (
            <>
              <div className="text-[11px] text-amber-600 uppercase tracking-wider px-3 pt-3 pb-2 font-medium">
                Templates
              </div>
              {templates.map((s) => renderSessionItem(s))}
              <div className="my-3 h-px bg-neutral-800 mx-2" />
            </>
          )}

          {/* フォルダ */}
          {rootFolders.map((f) => renderFolderTree(f))}

          {/* Unfiled */}
          {unfiled.length > 0 && (
            <>
              {rootFolders.length > 0 && (
                <div className="my-2 h-px bg-neutral-800 mx-2" />
              )}
              <div className="text-[11px] text-neutral-500 uppercase tracking-wider px-3 pt-2 pb-2 font-medium">
                Unfiled
              </div>
              {unfiled.map((s) => renderSessionItem(s))}
            </>
          )}

          {sessions.length === 0 && (
            <div className="text-sm text-neutral-600 text-center py-8">
              No sessions yet
            </div>
          )}
        </div>
      </div>

      {menuOpen && menuActions.length > 0 && (
        <ContextMenu
          actions={menuActions}
          anchorRect={menuOpen.rect}
          onClose={closeMenu}
        />
      )}
    </>
  );
}
