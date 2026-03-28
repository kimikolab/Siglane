"use client";

// WPFでいうと: TextBox（TwoWayバインディング）
// Reactでは value + onChange で双方向っぽい動きを実現する

interface MemoBoxProps {
  memo: string;
  onMemoChange: (memo: string) => void;
}

export default function MemoBox({ memo, onMemoChange }: MemoBoxProps) {
  return (
    <div>
      <label className="block text-xs text-neutral-500 uppercase tracking-wider mb-2">
        Memo
      </label>
      <textarea
        value={memo}
        onChange={(e) => onMemoChange(e.target.value)}
        className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-3 text-sm font-mono text-neutral-400 placeholder-neutral-600 resize-none focus:outline-none focus:border-neutral-500"
        rows={2}
        placeholder="seed: 12345 / cfg: 7 / steps: 28"
      />
    </div>
  );
}
