"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import type { DictionaryEntry } from "@/types";
import { loadDictionary } from "@/utils/dictionary";

interface PresetBrowserProps {
  /** Add all prompts from a preset to the session */
  onAddPreset: (type: "positive" | "negative", prompts: string[], groupLabel: string) => void;
  /** Open full preset management view */
  onOpenManage: () => void;
}

// --- Tree structure ---

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

  const sortChildren = (node: TreeNode) => {
    node.children.sort((a, b) => a.label.localeCompare(b.label));
    node.entries.sort((a, b) => a.label.localeCompare(b.label));
    for (const child of node.children) sortChildren(child);
  };
  sortChildren(root);

  return root;
}

function countEntries(node: TreeNode): number {
  let count = node.entries.length;
  for (const child of node.children) count += countEntries(child);
  return count;
}

// --- Component ---

export default function PresetBrowser({
  onAddPreset,
  onOpenManage,
}: PresetBrowserProps) {
  const [allEntries, setAllEntries] = useState<DictionaryEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set());
  const [expandedPresetId, setExpandedPresetId] = useState<string | null>(null);

  useEffect(() => {
    setAllEntries(loadDictionary());
  }, []);

  useEffect(() => {
    const onFocus = () => setAllEntries(loadDictionary());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  // Filter
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return allEntries;
    const q = searchQuery.toLowerCase();
    return allEntries.filter(
      (e) =>
        e.label.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        e.prompts.some((p) => p.toLowerCase().includes(q)),
    );
  }, [allEntries, searchQuery]);

  // Build tree from filtered entries
  const tree = useMemo(() => buildTree(filtered), [filtered]);

  const toggleCollapse = useCallback((path: string) => {
    setCollapsedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const handleAdd = useCallback(
    (entry: DictionaryEntry, shiftKey: boolean) => {
      const type = shiftKey ? "negative" : "positive";
      onAddPreset(type, entry.prompts, entry.category);
    },
    [onAddPreset],
  );

  return (
    <div className="flex flex-col gap-2 h-full">
      {/* Search */}
      <div className="flex flex-col gap-1.5 flex-shrink-0">
        <input
          type="text"
          placeholder="Search presets..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-neutral-800 border border-neutral-700 rounded px-2.5 py-1.5 text-xs text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500"
        />
        <span className="text-[10px] text-neutral-600">
          {filtered.length}/{allEntries.length} presets
        </span>
      </div>

      {/* Tree list */}
      <div className="flex-1 overflow-y-auto sidebar-scroll min-h-0">
        {filtered.length === 0 ? (
          <p className="text-xs text-neutral-600 text-center py-6">
            {searchQuery ? "No matching presets" : "No presets registered"}
          </p>
        ) : (
          <div className="flex flex-col">
            {tree.children.map((child) => (
              <CategoryNode
                key={child.fullPath}
                node={child}
                depth={0}
                collapsedPaths={collapsedPaths}
                expandedPresetId={expandedPresetId}
                onToggleCollapse={toggleCollapse}
                onTogglePreset={(id) =>
                  setExpandedPresetId(expandedPresetId === id ? null : id)
                }
                onAdd={handleAdd}
              />
            ))}
            {tree.entries.map((entry) => (
              <PresetItem
                key={entry.id}
                entry={entry}
                depth={0}
                isExpanded={expandedPresetId === entry.id}
                onToggleExpand={() =>
                  setExpandedPresetId(
                    expandedPresetId === entry.id ? null : entry.id,
                  )
                }
                onAdd={handleAdd}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 pt-1 border-t border-neutral-800">
        <button
          onClick={onOpenManage}
          className="text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          Manage presets →
        </button>
      </div>
    </div>
  );
}

// --- Category node (folder) ---

function CategoryNode({
  node,
  depth,
  collapsedPaths,
  expandedPresetId,
  onToggleCollapse,
  onTogglePreset,
  onAdd,
}: {
  node: TreeNode;
  depth: number;
  collapsedPaths: Set<string>;
  expandedPresetId: string | null;
  onToggleCollapse: (path: string) => void;
  onTogglePreset: (id: string) => void;
  onAdd: (entry: DictionaryEntry, shiftKey: boolean) => void;
}) {
  const isCollapsed = collapsedPaths.has(node.fullPath);
  const total = countEntries(node);

  return (
    <div>
      {/* Category header */}
      <button
        onClick={() => onToggleCollapse(node.fullPath)}
        className="flex items-center gap-1 w-full text-left px-1 py-1 hover:bg-neutral-800/40 rounded transition-colors"
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        <span className="text-[10px] text-neutral-600 w-3 flex-shrink-0">
          {isCollapsed ? "▶" : "▼"}
        </span>
        <span className={`text-[11px] font-medium truncate ${
          depth === 0 ? "text-sky-400/80" : "text-neutral-400"
        }`}>
          {node.label}
        </span>
        <span className="text-[10px] text-neutral-600 flex-shrink-0">
          {total}
        </span>
      </button>

      {/* Children */}
      {!isCollapsed && (
        <>
          {node.children.map((child) => (
            <CategoryNode
              key={child.fullPath}
              node={child}
              depth={depth + 1}
              collapsedPaths={collapsedPaths}
              expandedPresetId={expandedPresetId}
              onToggleCollapse={onToggleCollapse}
              onTogglePreset={onTogglePreset}
              onAdd={onAdd}
            />
          ))}
          {node.entries.map((entry) => (
            <PresetItem
              key={entry.id}
              entry={entry}
              depth={depth + 1}
              isExpanded={expandedPresetId === entry.id}
              onToggleExpand={() => onTogglePreset(entry.id)}
              onAdd={onAdd}
            />
          ))}
        </>
      )}
    </div>
  );
}

// --- Preset item ---

function PresetItem({
  entry,
  depth,
  isExpanded,
  onToggleExpand,
  onAdd,
}: {
  entry: DictionaryEntry;
  depth: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onAdd: (entry: DictionaryEntry, shiftKey: boolean) => void;
}) {
  return (
    <div
      className="rounded hover:bg-neutral-800/60 transition-colors"
      style={{ paddingLeft: `${depth * 12 + 4}px` }}
    >
      {/* Header */}
      <div className="flex items-center gap-1 px-1 py-1.5">
        <button
          onClick={onToggleExpand}
          className="text-[10px] text-neutral-600 hover:text-neutral-400 transition-colors w-3 flex-shrink-0"
        >
          {isExpanded ? "▼" : "▶"}
        </button>
        <div className="flex-1 min-w-0">
          <span className="text-xs text-neutral-200 truncate block">
            {entry.label}
          </span>
          <span className="text-[10px] text-neutral-600">
            {entry.prompts.length} tags
          </span>
        </div>
        <button
          onClick={(e) => onAdd(entry, e.shiftKey)}
          className="text-neutral-600 hover:text-sky-400 transition-colors text-xs flex-shrink-0 px-1"
          title="Click: add to Positive / Shift+click: add to Negative"
        >
          +
        </button>
      </div>
      {/* Expanded tags */}
      {isExpanded && (
        <div className="px-1 pb-2" style={{ marginLeft: "16px" }}>
          <div className="flex flex-wrap gap-1">
            {entry.prompts.map((p, i) => (
              <span
                key={i}
                className="text-[10px] bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded font-mono"
              >
                {p}
              </span>
            ))}
          </div>
          {entry.note && (
            <p className="text-[10px] text-neutral-600 mt-1">{entry.note}</p>
          )}
        </div>
      )}
    </div>
  );
}
