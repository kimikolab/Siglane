"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { DictionaryEntry, DEFAULT_GROUP_CATEGORIES } from "@/types";
import {
  loadDictionary,
  addEntry,
  createEntry,
  deleteEntry,
  renameEntry,
  updateEntryPrompts,
  updateEntryCategory,
  duplicateEntry,
} from "@/utils/dictionary";

// --- ツリー構造 ---

interface TreeNode {
  label: string;
  fullPath: string;
  children: TreeNode[];
  entries: DictionaryEntry[];
}

function buildTree(entries: DictionaryEntry[]): TreeNode {
  const root: TreeNode = { label: "", fullPath: "", children: [], entries: [] };

  for (const entry of entries) {
    const segments = entry.category.split("/").filter((s) => s.trim());
    let node = root;
    let path = "";
    for (const seg of segments) {
      path = path ? `${path}/${seg}` : seg;
      let child = node.children.find((c) => c.label === seg);
      if (!child) {
        child = { label: seg, fullPath: path, children: [], entries: [] };
        node.children.push(child);
      }
      node = child;
    }
    node.entries.push(entry);
  }

  // カテゴリ名でソート
  const sortChildren = (node: TreeNode) => {
    node.children.sort((a, b) => a.label.localeCompare(b.label));
    node.entries.sort((a, b) => a.label.localeCompare(b.label));
    for (const child of node.children) sortChildren(child);
  };
  sortChildren(root);

  return root;
}

// --- コンポーネント ---

export default function PresetView() {
  const [allEntries, setAllEntries] = useState<DictionaryEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set());
  const [expandedPresetId, setExpandedPresetId] = useState<string | null>(null);

  // --- 新規作成 ---
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newPrompts, setNewPrompts] = useState("");
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  // localStorage から読み込み
  useEffect(() => {
    setAllEntries(loadDictionary());
  }, []);

  const reload = useCallback(() => {
    setAllEntries(loadDictionary());
  }, []);

  const resetCreating = useCallback(() => {
    setIsCreating(false);
    setNewName("");
    setNewCategory("");
    setNewPrompts("");
    setShowCategoryDropdown(false);
  }, []);

  const handleCreate = useCallback(() => {
    const name = newName.trim();
    const category = newCategory.trim();
    const prompts = newPrompts
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (!name || !category || prompts.length === 0) return;
    addEntry(createEntry(name, category, prompts));
    resetCreating();
    reload();
  }, [newName, newCategory, newPrompts, resetCreating, reload]);

  // 検索フィルタ
  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return allEntries;
    const q = searchQuery.toLowerCase();
    return allEntries.filter(
      (e) =>
        e.label.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        e.prompts.some((p) => p.toLowerCase().includes(q)),
    );
  }, [allEntries, searchQuery]);

  const tree = useMemo(() => buildTree(filteredEntries), [filteredEntries]);

  const toggleCollapse = useCallback((path: string) => {
    setCollapsedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  // --- アクション ---
  const handleDelete = useCallback(
    (id: string, label: string) => {
      if (!window.confirm(`Delete preset "${label}"?`)) return;
      deleteEntry(id);
      reload();
      if (expandedPresetId === id) setExpandedPresetId(null);
    },
    [reload, expandedPresetId],
  );

  const handleRename = useCallback(
    (id: string, newLabel: string) => {
      renameEntry(id, newLabel);
      reload();
    },
    [reload],
  );

  const handleDuplicate = useCallback(
    (id: string) => {
      duplicateEntry(id);
      reload();
    },
    [reload],
  );

  const handleMove = useCallback(
    (id: string, newCategory: string) => {
      updateEntryCategory(id, newCategory);
      reload();
    },
    [reload],
  );

  const handleUpdatePrompts = useCallback(
    (id: string, prompts: string[]) => {
      updateEntryPrompts(id, prompts);
      reload();
    },
    [reload],
  );

  // ツリー内の全カテゴリパスを収集（移動先候補用）
  const allCategoryPaths = useMemo(() => {
    const paths = new Set<string>();
    for (const e of allEntries) {
      paths.add(e.category);
      // 中間パスも追加
      const segs = e.category.split("/");
      for (let i = 1; i < segs.length; i++) {
        paths.add(segs.slice(0, i).join("/"));
      }
    }
    // DEFAULT_GROUP_CATEGORIES も含む
    for (const cat of DEFAULT_GROUP_CATEGORIES) {
      paths.add(cat);
    }
    return [...paths].sort();
  }, [allEntries]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <p className="text-xs text-neutral-500">
          {allEntries.length} presets in{" "}
          {new Set(allEntries.map((e) => e.category)).size} categories
        </p>
        <button
          onClick={() => setIsCreating(true)}
          className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
          title="New preset"
        >
          + New Preset
        </button>
      </div>

      {/* 検索 */}
      <div className="flex items-center gap-3 mb-4 flex-shrink-0">
        <div className="flex-1 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search presets, categories, prompts..."
            className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-500 pr-8"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 text-sm"
            >
              ×
            </button>
          )}
        </div>
        <span className="text-[11px] text-neutral-600">
          {filteredEntries.length}
          {searchQuery ? " results" : " total"}
        </span>
      </div>

      {/* 新規作成フォーム */}
      {isCreating && (
        <div className="bg-neutral-800 border border-neutral-700/60 rounded-lg px-4 py-3 mb-4 flex-shrink-0 space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Preset name..."
              autoFocus
              className="flex-1 bg-neutral-900 border border-neutral-600 rounded px-2.5 py-1.5 text-sm text-neutral-200 focus:outline-none focus:border-sky-500"
            />
            <div className="relative">
              <button
                onClick={() => setShowCategoryDropdown((p) => !p)}
                className="px-2.5 py-1.5 text-sm bg-neutral-700 hover:bg-neutral-600 text-neutral-300 rounded truncate max-w-[200px]"
              >
                {newCategory || "Category..."}
              </button>
              {showCategoryDropdown && (
                <div
                  className="absolute top-full right-0 mt-1 bg-neutral-800 border border-neutral-600 rounded-lg shadow-xl py-1 min-w-[180px] max-h-[240px] overflow-y-auto"
                  style={{ zIndex: 50 }}
                >
                  {allCategoryPaths.map((path) => (
                    <button
                      key={path}
                      onClick={() => {
                        setNewCategory(path);
                        setShowCategoryDropdown(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-700 transition-colors truncate"
                    >
                      {path}
                    </button>
                  ))}
                  <div className="border-t border-neutral-700 mt-1 pt-1 px-3 py-1">
                    <input
                      type="text"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      placeholder="Custom path..."
                      className="w-full bg-neutral-900 border border-neutral-600 rounded px-2 py-1 text-xs text-neutral-200 focus:outline-none focus:border-neutral-400"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") setShowCategoryDropdown(false);
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          <textarea
            value={newPrompts}
            onChange={(e) => setNewPrompts(e.target.value)}
            rows={4}
            placeholder="One prompt per line..."
            className="w-full bg-neutral-900 border border-neutral-600 rounded px-2.5 py-1.5 text-xs font-mono text-neutral-200 focus:outline-none focus:border-sky-500 resize-y"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || !newCategory.trim() || !newPrompts.trim()}
              className="px-3 py-1 text-xs bg-sky-600 hover:bg-sky-500 text-white rounded transition-colors disabled:opacity-40"
            >
              Create
            </button>
            <button
              onClick={resetCreating}
              className="px-3 py-1 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              Cancel
            </button>
            <span className="text-[10px] text-neutral-600 ml-auto">
              {newPrompts.split("\n").filter((s) => s.trim()).length} prompts
            </span>
          </div>
        </div>
      )}

      {/* ツリー表示 */}
      <div className="flex-1 overflow-y-auto sidebar-scroll pb-4">
        {tree.children.length === 0 && tree.entries.length === 0 ? (
          <p className="text-sm text-neutral-600 text-center py-8">
            {searchQuery
              ? "No matching presets"
              : "No presets yet — save groups from the editor to build your library"}
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {tree.children.map((child) => (
              <TreeNodeView
                key={child.fullPath}
                node={child}
                depth={0}
                collapsedPaths={collapsedPaths}
                onToggleCollapse={toggleCollapse}
                expandedPresetId={expandedPresetId}
                onExpandPreset={setExpandedPresetId}
                onDelete={handleDelete}
                onRename={handleRename}
                onDuplicate={handleDuplicate}
                onMove={handleMove}
                onUpdatePrompts={handleUpdatePrompts}
                allCategoryPaths={allCategoryPaths}
              />
            ))}
            {/* ルートレベルのエントリ（カテゴリなし） */}
            {tree.entries.map((entry) => (
              <PresetRow
                key={entry.id}
                entry={entry}
                depth={0}
                isExpanded={expandedPresetId === entry.id}
                onExpand={setExpandedPresetId}
                onDelete={handleDelete}
                onRename={handleRename}
                onDuplicate={handleDuplicate}
                onMove={handleMove}
                onUpdatePrompts={handleUpdatePrompts}
                allCategoryPaths={allCategoryPaths}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// --- ツリーノード ---

function TreeNodeView({
  node,
  depth,
  collapsedPaths,
  onToggleCollapse,
  expandedPresetId,
  onExpandPreset,
  onDelete,
  onRename,
  onDuplicate,
  onMove,
  onUpdatePrompts,
  allCategoryPaths,
}: {
  node: TreeNode;
  depth: number;
  collapsedPaths: Set<string>;
  onToggleCollapse: (path: string) => void;
  expandedPresetId: string | null;
  onExpandPreset: (id: string | null) => void;
  onDelete: (id: string, label: string) => void;
  onRename: (id: string, newLabel: string) => void;
  onDuplicate: (id: string) => void;
  onMove: (id: string, newCategory: string) => void;
  onUpdatePrompts: (id: string, prompts: string[]) => void;
  allCategoryPaths: string[];
}) {
  const isCollapsed = collapsedPaths.has(node.fullPath);
  const totalCount = countEntries(node);

  return (
    <div>
      {/* フォルダヘッダー */}
      <div
        className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-neutral-800/60 transition-colors"
        style={{ paddingLeft: 8 + depth * 16 }}
        onClick={() => onToggleCollapse(node.fullPath)}
      >
        <span className="text-neutral-500 text-xs w-4 text-center flex-shrink-0">
          {isCollapsed ? "▶" : "▼"}
        </span>
        <span className={`text-sm flex-1 min-w-0 truncate ${
          depth === 0
            ? "font-medium text-sky-400/80"
            : "text-neutral-300"
        }`}>
          {node.label}
        </span>
        <span className="text-[10px] text-neutral-600 flex-shrink-0">
          {totalCount}
        </span>
      </div>

      {/* 子要素 */}
      {!isCollapsed && (
        <>
          {node.children.map((child) => (
            <TreeNodeView
              key={child.fullPath}
              node={child}
              depth={depth + 1}
              collapsedPaths={collapsedPaths}
              onToggleCollapse={onToggleCollapse}
              expandedPresetId={expandedPresetId}
              onExpandPreset={onExpandPreset}
              onDelete={onDelete}
              onRename={onRename}
              onDuplicate={onDuplicate}
              onMove={onMove}
              onUpdatePrompts={onUpdatePrompts}
              allCategoryPaths={allCategoryPaths}
            />
          ))}
          {node.entries.map((entry) => (
            <PresetRow
              key={entry.id}
              entry={entry}
              depth={depth + 1}
              isExpanded={expandedPresetId === entry.id}
              onExpand={onExpandPreset}
              onDelete={onDelete}
              onRename={onRename}
              onDuplicate={onDuplicate}
              onMove={onMove}
              onUpdatePrompts={onUpdatePrompts}
              allCategoryPaths={allCategoryPaths}
            />
          ))}
        </>
      )}
    </div>
  );
}

function countEntries(node: TreeNode): number {
  let count = node.entries.length;
  for (const child of node.children) count += countEntries(child);
  return count;
}

// --- プリセット行 ---

function PresetRow({
  entry,
  depth,
  isExpanded,
  onExpand,
  onDelete,
  onRename,
  onDuplicate,
  onMove,
  onUpdatePrompts,
  allCategoryPaths,
}: {
  entry: DictionaryEntry;
  depth: number;
  isExpanded: boolean;
  onExpand: (id: string | null) => void;
  onDelete: (id: string, label: string) => void;
  onRename: (id: string, newLabel: string) => void;
  onDuplicate: (id: string) => void;
  onMove: (id: string, newCategory: string) => void;
  onUpdatePrompts: (id: string, prompts: string[]) => void;
  allCategoryPaths: string[];
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [showActions, setShowActions] = useState(false);
  const [isEditingPrompts, setIsEditingPrompts] = useState(false);
  const [editPromptsValue, setEditPromptsValue] = useState("");
  const [showMoveDropdown, setShowMoveDropdown] = useState(false);
  const [customMovePath, setCustomMovePath] = useState("");

  const startRename = () => {
    setRenameValue(entry.label);
    setIsRenaming(true);
    setShowActions(false);
  };

  const commitRename = () => {
    if (renameValue.trim() && renameValue.trim() !== entry.label) {
      onRename(entry.id, renameValue.trim());
    }
    setIsRenaming(false);
  };

  const startEditPrompts = () => {
    setEditPromptsValue(entry.prompts.join("\n"));
    setIsEditingPrompts(true);
    setShowActions(false);
    if (!isExpanded) onExpand(entry.id);
  };

  const commitEditPrompts = () => {
    const newPrompts = editPromptsValue
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (newPrompts.length > 0) {
      onUpdatePrompts(entry.id, newPrompts);
    }
    setIsEditingPrompts(false);
  };

  return (
    <div>
      {/* プリセット行 */}
      <div
        className={`group flex items-center gap-2 px-2 py-1.5 rounded transition-colors cursor-pointer ${
          isExpanded
            ? "bg-neutral-800 border border-neutral-700/60"
            : "hover:bg-neutral-800/60 border border-transparent"
        }`}
        style={{ paddingLeft: 8 + depth * 16 }}
        onClick={() => {
          if (!isRenaming) onExpand(isExpanded ? null : entry.id);
        }}
      >
        {/* 展開インジケーター */}
        <span className="text-neutral-600 text-xs w-4 text-center flex-shrink-0">
          {isExpanded ? "▼" : "▶"}
        </span>

        {/* 名前 */}
        {isRenaming ? (
          <input
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            autoFocus
            className="flex-1 bg-neutral-900 border border-neutral-600 rounded px-2 py-0.5 text-sm text-neutral-200 focus:outline-none focus:border-sky-500 min-w-0"
            onClick={(e) => e.stopPropagation()}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") setIsRenaming(false);
            }}
          />
        ) : (
          <span className="text-sm text-neutral-200 flex-1 min-w-0 truncate">
            {entry.label}
          </span>
        )}

        {/* タグ数 */}
        <span className="text-[10px] text-neutral-600 flex-shrink-0">
          ({entry.prompts.length})
        </span>

        {/* アクションメニュー */}
        <div className="relative flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowActions((p) => !p);
              setShowMoveDropdown(false);
            }}
            className="opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-neutral-300 transition-all p-1 rounded hover:bg-neutral-700"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <circle cx="8" cy="3" r="1.5" />
              <circle cx="8" cy="8" r="1.5" />
              <circle cx="8" cy="13" r="1.5" />
            </svg>
          </button>
          {showActions && (
            <div
              className="absolute top-full right-0 mt-1 bg-neutral-800 border border-neutral-600 rounded-lg shadow-xl py-1 min-w-[150px]"
              style={{ zIndex: 50 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => startRename()}
                className="w-full text-left px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-700 transition-colors"
              >
                Rename
              </button>
              <button
                onClick={() => startEditPrompts()}
                className="w-full text-left px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-700 transition-colors"
              >
                Edit prompts
              </button>
              <button
                onClick={() => {
                  setShowMoveDropdown((p) => !p);
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-700 transition-colors flex items-center justify-between"
              >
                Move to
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 16 16"
                  fill="none"
                >
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
                onClick={() => {
                  onDuplicate(entry.id);
                  setShowActions(false);
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-700 transition-colors"
              >
                Duplicate
              </button>
              <div className="border-t border-neutral-700 my-1" />
              <button
                onClick={() => {
                  onDelete(entry.id, entry.label);
                  setShowActions(false);
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-neutral-700 transition-colors"
              >
                Delete
              </button>
            </div>
          )}
          {/* Move toサブメニュー */}
          {showActions && showMoveDropdown && (
            <div
              className="absolute top-full right-full mr-1 mt-1 bg-neutral-800 border border-neutral-600 rounded-lg shadow-xl py-1 min-w-[180px] max-h-[280px] overflow-y-auto"
              style={{ zIndex: 51 }}
              onClick={(e) => e.stopPropagation()}
            >
              {allCategoryPaths
                .filter((p) => p !== entry.category)
                .map((path) => (
                  <button
                    key={path}
                    onClick={() => {
                      onMove(entry.id, path);
                      setShowActions(false);
                      setShowMoveDropdown(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-700 transition-colors truncate"
                    title={path}
                  >
                    {path}
                  </button>
                ))}
              <div className="border-t border-neutral-700 mt-1 pt-1 px-3 py-1">
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={customMovePath}
                    onChange={(e) => setCustomMovePath(e.target.value)}
                    placeholder="New path..."
                    className="flex-1 bg-neutral-900 border border-neutral-600 rounded px-2 py-1 text-xs text-neutral-200 focus:outline-none focus:border-neutral-400 min-w-0"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && customMovePath.trim()) {
                        onMove(entry.id, customMovePath.trim());
                        setCustomMovePath("");
                        setShowActions(false);
                        setShowMoveDropdown(false);
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (customMovePath.trim()) {
                        onMove(entry.id, customMovePath.trim());
                        setCustomMovePath("");
                        setShowActions(false);
                        setShowMoveDropdown(false);
                      }
                    }}
                    className="px-2 py-1 text-xs bg-sky-600 hover:bg-sky-500 text-white rounded transition-colors"
                  >
                    →
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 展開時: プロンプト一覧 */}
      {isExpanded && (
        <div
          className="bg-neutral-850 border-x border-b border-neutral-700/40 rounded-b px-3 py-2 mb-1"
          style={{ marginLeft: 8 + depth * 16 }}
        >
          {isEditingPrompts ? (
            <div>
              <textarea
                value={editPromptsValue}
                onChange={(e) => setEditPromptsValue(e.target.value)}
                rows={Math.min(entry.prompts.length + 2, 12)}
                className="w-full bg-neutral-900 border border-neutral-600 rounded px-2 py-1.5 text-xs font-mono text-neutral-200 focus:outline-none focus:border-sky-500 resize-y"
                placeholder="One prompt per line..."
                autoFocus
              />
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={commitEditPrompts}
                  className="px-3 py-1 text-xs bg-sky-600 hover:bg-sky-500 text-white rounded transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => setIsEditingPrompts(false)}
                  className="px-3 py-1 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
                >
                  Cancel
                </button>
                <span className="text-[10px] text-neutral-600 ml-auto">
                  {editPromptsValue.split("\n").filter((s) => s.trim()).length}{" "}
                  prompts
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {entry.prompts.map((prompt, i) => (
                <span
                  key={i}
                  className="text-xs font-mono text-neutral-400 py-0.5"
                >
                  {prompt}
                </span>
              ))}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  startEditPrompts();
                }}
                className="text-[10px] text-neutral-600 hover:text-neutral-400 transition-colors mt-1 text-left"
              >
                ✏️ Edit prompts
              </button>
            </div>
          )}
          {/* カテゴリパス表示 */}
          <div className="mt-2 pt-2 border-t border-neutral-700/40 flex items-center gap-2">
            <span className="text-[10px] text-neutral-600">
              {entry.category}
            </span>
            <span className="text-[10px] text-neutral-700">·</span>
            <span className="text-[10px] text-neutral-600">
              {new Date(entry.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
