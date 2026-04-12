"use client";

import { useState, useEffect } from "react";

// 旧InputArea + 旧OutputAreaを統合
// テキストエリアとグリッドが双方向に同期する

interface InputAreaProps {
  label: string;
  labelColor?: string;
  rows?: number;
  allText: string;
  copyText: string;
  onSync: (text: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function InputArea({
  label,
  labelColor = "text-neutral-300",
  rows = 3,
  allText,
  copyText,
  onSync,
  collapsed = false,
  onToggleCollapse,
}: InputAreaProps) {
  // ローカル状態: テキストエリアの編集中の値
  // WPFでいうと: TextBoxのTextプロパティ（ローカルで持ちつつ、外部からも更新される）
  const [localText, setLocalText] = useState(allText);
  const [isFocused, setIsFocused] = useState(false);
  const [copied, setCopied] = useState(false);

  // グリッドからの変更をテキストエリアに反映（フォーカス中は上書きしない）
  useEffect(() => {
    if (!isFocused) {
      setLocalText(allText);
    }
  }, [allText, isFocused]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(copyText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="text-[10px] text-neutral-600 hover:text-neutral-400 transition-colors"
            >
              {collapsed ? "▶" : "▼"}
            </button>
          )}
          <label className={`text-xs uppercase tracking-wider ${labelColor}`}>
            {label}
          </label>
        </div>
        <button
          onClick={handleCopy}
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      {!collapsed && (
        <textarea
          value={localText}
          onChange={(e) => setLocalText(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            onSync(localText);
          }}
          className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-3 text-sm font-mono text-neutral-300 placeholder-neutral-600 resize-none focus:outline-none focus:border-neutral-500"
          rows={rows}
          placeholder={`Paste or type ${label.toLowerCase()} prompt...`}
        />
      )}
    </div>
  );
}
