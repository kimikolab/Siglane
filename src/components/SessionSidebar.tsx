"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Session } from "@/types";

interface SessionSidebarProps {
  sessions: Session[];
  activeSessionId: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDuplicateSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, newLabel: string) => void;
  onToggleTemplate: (id: string) => void;
  onOpenFromTemplate: (id: string) => void;
}

// --- コンテキストメニュー（Portal描画） ---
interface ContextMenuProps {
  session: Session;
  anchorRect: DOMRect;
  onClose: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onToggleTemplate: () => void;
  onDelete: () => void;
}

function ContextMenu({
  session,
  anchorRect,
  onClose,
  onRename,
  onDuplicate,
  onToggleTemplate,
  onDelete,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

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
      <button
        onClick={() => {
          onRename();
          onClose();
        }}
        className="w-full text-left px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-700 transition-colors"
      >
        Rename
      </button>
      <button
        onClick={() => {
          onDuplicate();
          onClose();
        }}
        className="w-full text-left px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-700 transition-colors"
      >
        Duplicate
      </button>
      <button
        onClick={() => {
          onToggleTemplate();
          onClose();
        }}
        className="w-full text-left px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-700 transition-colors"
      >
        {session.isTemplate ? "Unlock (remove template)" : "Lock as template"}
      </button>
      <div className="my-1 h-px bg-neutral-700 mx-3" />
      <button
        onClick={() => {
          onDelete();
          onClose();
        }}
        className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-neutral-700 transition-colors"
      >
        Delete
      </button>
    </div>,
    document.body,
  );
}

// --- メインコンポーネント ---
export default function SessionSidebar({
  sessions,
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
}: SessionSidebarProps) {
  const [menuOpen, setMenuOpen] = useState<{
    sessionId: string;
    rect: DOMRect;
  } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const closeMenu = useCallback(() => setMenuOpen(null), []);

  const templates = sessions
    .filter((s) => s.isTemplate)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const regular = sessions
    .filter((s) => !s.isTemplate)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const handleSessionClick = (session: Session) => {
    if (session.isTemplate) {
      onOpenFromTemplate(session.id);
    } else {
      onSelectSession(session.id);
    }
  };

  const startRename = (session: Session) => {
    setRenamingId(session.id);
    setRenameValue(session.label);
  };

  const commitRename = () => {
    if (renamingId && renameValue.trim()) {
      onRenameSession(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  };

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

  const openMenu = (sessionId: string, buttonEl: HTMLElement) => {
    const rect = buttonEl.getBoundingClientRect();
    setMenuOpen({ sessionId, rect });
  };

  // 折りたたみ時
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
          onClick={onNewSession}
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

  const menuSession = menuOpen
    ? sessions.find((s) => s.id === menuOpen.sessionId)
    : null;

  const renderItem = (session: Session) => {
    const isActive = session.id === activeSessionId;
    const isRenaming = renamingId === session.id;

    return (
      <div
        key={session.id}
        className={`group rounded-lg px-4 py-3 cursor-pointer transition-colors ${
          isActive
            ? "bg-neutral-700/60 border border-neutral-600/60"
            : "hover:bg-neutral-800/80 border border-transparent"
        }`}
        onClick={() => !isRenaming && handleSessionClick(session)}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {session.isTemplate && (
            <span
              className="flex-shrink-0 text-amber-500"
              title="Template (click to create copy)"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
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
                className="w-full bg-neutral-900 border border-neutral-500 rounded px-2 py-1 text-sm text-neutral-200 focus:outline-none focus:border-neutral-400"
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
              if (menuOpen?.sessionId === session.id) {
                closeMenu();
              } else {
                openMenu(session.id, e.currentTarget);
              }
            }}
            className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-neutral-200 transition-all p-1 rounded hover:bg-neutral-700"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="8" cy="3" r="1.5" />
              <circle cx="8" cy="8" r="1.5" />
              <circle cx="8" cy="13" r="1.5" />
            </svg>
          </button>
        </div>
      </div>
    );
  };

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
              onClick={onNewSession}
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
        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-1 sidebar-scroll">
          {/* テンプレート */}
          {templates.length > 0 && (
            <>
              <div className="text-[11px] text-amber-600 uppercase tracking-wider px-4 pt-3 pb-2 font-medium">
                Templates
              </div>
              {templates.map(renderItem)}
              <div className="my-3 h-px bg-neutral-800" />
            </>
          )}

          {/* 通常セッション */}
          <div className="text-[11px] text-neutral-500 uppercase tracking-wider px-4 pt-2 pb-2 font-medium">
            Sessions
          </div>
          {regular.map(renderItem)}

          {sessions.length === 0 && (
            <div className="text-sm text-neutral-600 text-center py-8">
              No sessions yet
            </div>
          )}
        </div>
      </div>

      {/* コンテキストメニュー（Portal） */}
      {menuOpen && menuSession && (
        <ContextMenu
          session={menuSession}
          anchorRect={menuOpen.rect}
          onClose={closeMenu}
          onRename={() => startRename(menuSession)}
          onDuplicate={() => onDuplicateSession(menuSession.id)}
          onToggleTemplate={() => onToggleTemplate(menuSession.id)}
          onDelete={() => onDeleteSession(menuSession.id)}
        />
      )}
    </>
  );
}
