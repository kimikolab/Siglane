"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { PinnedParameter } from "@/types";
import type {
  ComfyApiWorkflow,
  ComfyConnection,
  PinnableNode,
  PinnableParam,
  InputDef,
} from "@/utils/comfyApi";
import {
  extractPinnableNodes,
  fetchNodeInputDefs,
} from "@/utils/comfyApi";

interface WorkflowPanelProps {
  workflow: ComfyApiWorkflow | undefined;
  positiveNodeId: string | undefined;
  negativeNodeId: string | undefined;
  pinnedParameters: PinnedParameter[];
  connection: ComfyConnection | null;
  onPinParameter: (pin: PinnedParameter) => void;
  onUnpinParameter: (pinId: string) => void;
}

export default function WorkflowPanel({
  workflow,
  positiveNodeId,
  negativeNodeId,
  pinnedParameters,
  connection,
  onPinParameter,
  onUnpinParameter,
}: WorkflowPanelProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [inputDefs, setInputDefs] = useState<Record<string, InputDef[]>>({});
  const [loadingDefs, setLoadingDefs] = useState<Set<string>>(new Set());

  const pinnableNodes = useMemo(() => {
    if (!workflow) return [];
    return extractPinnableNodes(workflow, positiveNodeId, negativeNodeId);
  }, [workflow, positiveNodeId, negativeNodeId]);

  // ピン済みのキーセット
  const pinnedKeys = useMemo(() => {
    return new Set(pinnedParameters.map((p) => `${p.nodeId}:${p.paramName}`));
  }, [pinnedParameters]);

  // ノード展開トグル + /object_info取得
  const toggleNode = useCallback(
    async (node: PinnableNode) => {
      setExpandedNodes((prev) => {
        const next = new Set(prev);
        if (next.has(node.nodeId)) {
          next.delete(node.nodeId);
        } else {
          next.add(node.nodeId);
        }
        return next;
      });

      // /object_info未取得 + ComfyUI接続中なら取得
      if (!inputDefs[node.classType] && connection && !loadingDefs.has(node.classType)) {
        setLoadingDefs((prev) => new Set(prev).add(node.classType));
        const defs = await fetchNodeInputDefs(connection, node.classType);
        setInputDefs((prev) => ({ ...prev, [node.classType]: defs }));
        setLoadingDefs((prev) => {
          const next = new Set(prev);
          next.delete(node.classType);
          return next;
        });
      }
    },
    [connection, inputDefs, loadingDefs],
  );

  // パラメータをピン留め
  const handlePin = useCallback(
    (node: PinnableNode, param: PinnableParam) => {
      // /object_infoの制約を探す
      const defs = inputDefs[node.classType] ?? [];
      const def = defs.find((d) => d.paramName === param.paramName);

      const pin: PinnedParameter = {
        id: crypto.randomUUID(),
        nodeId: node.nodeId,
        nodeClassType: node.classType,
        paramName: param.paramName,
        label: `${node.title} / ${param.paramName}`,
        type: param.type,
        value: def?.isInteger ? Math.round(param.value as number) : param.value,
        defaultValue: param.value,
        min: def?.min,
        max: def?.max,
        step: def?.isInteger ? Math.max(1, def?.step ?? 1) : def?.step,
        isInteger: def?.isInteger,
        options: def?.options,
      };
      onPinParameter(pin);
    },
    [inputDefs, onPinParameter],
  );

  // ピン解除
  const handleUnpin = useCallback(
    (nodeId: string, paramName: string) => {
      const pin = pinnedParameters.find(
        (p) => p.nodeId === nodeId && p.paramName === paramName,
      );
      if (pin) onUnpinParameter(pin.id);
    },
    [pinnedParameters, onUnpinParameter],
  );

  // ノードの全パラメータをピン留め
  const handlePinAll = useCallback(
    (node: PinnableNode) => {
      if (node.isBound) return;
      const defs = inputDefs[node.classType] ?? [];
      for (const param of node.params) {
        const key = `${node.nodeId}:${param.paramName}`;
        if (pinnedKeys.has(key)) continue;
        const def = defs.find((d) => d.paramName === param.paramName);
        const pin: PinnedParameter = {
          id: crypto.randomUUID(),
          nodeId: node.nodeId,
          nodeClassType: node.classType,
          paramName: param.paramName,
          label: `${node.title} / ${param.paramName}`,
          type: param.type,
          value: def?.isInteger ? Math.round(param.value as number) : param.value,
          defaultValue: param.value,
          min: def?.min,
          max: def?.max,
          step: def?.isInteger ? Math.max(1, def?.step ?? 1) : def?.step,
          isInteger: def?.isInteger,
          options: def?.options,
        };
        onPinParameter(pin);
      }
    },
    [inputDefs, pinnedKeys, onPinParameter],
  );

  // ノードの全パラメータをピン解除
  const handleUnpinAll = useCallback(
    (node: PinnableNode) => {
      for (const param of node.params) {
        const pin = pinnedParameters.find(
          (p) => p.nodeId === node.nodeId && p.paramName === param.paramName,
        );
        if (pin) onUnpinParameter(pin.id);
      }
    },
    [pinnedParameters, onUnpinParameter],
  );

  if (!workflow) {
    return (
      <div className="text-xs text-neutral-600 text-center mt-8">
        No API workflow loaded.
        <br />
        <span className="text-neutral-500">
          Load a workflow via Generate button to see nodes here.
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="text-[10px] text-neutral-600 mb-2 px-1">
        Expand nodes and 📌 pin parameters to control them from the Generate panel.
      </div>
      <div className="flex-1 overflow-y-auto sidebar-scroll space-y-1">
        {pinnableNodes.map((node) => {
          const isExpanded = expandedNodes.has(node.nodeId);

          return (
            <div key={node.nodeId}>
              {/* ノードヘッダー */}
              <div
                onClick={() => toggleNode(node)}
                className={`w-full text-left flex items-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors cursor-pointer ${
                  node.isBound
                    ? "text-neutral-600 hover:bg-neutral-800/50"
                    : "text-neutral-300 hover:bg-neutral-800"
                }`}
              >
                <span className="flex-shrink-0 text-[10px] text-neutral-600 w-4">
                  {isExpanded ? "▼" : "▶"}
                </span>
                <span
                  className={`font-mono text-[10px] flex-shrink-0 ${
                    node.isBound ? "text-neutral-700" : "text-neutral-500"
                  }`}
                >
                  [{node.nodeId}]
                </span>
                <span className="truncate flex-1">
                  {node.title}
                </span>
                {node.isBound && (
                  <span className="text-[9px] text-sky-700 flex-shrink-0">
                    bound
                  </span>
                )}
                {/* ピン済みパラメータ数 + ノード一括ピンボタン */}
                {(() => {
                  const pinnableParams = node.params.filter(
                    () => !node.isBound,
                  );
                  const pinCount = pinnableParams.filter((p) =>
                    pinnedKeys.has(`${node.nodeId}:${p.paramName}`),
                  ).length;
                  const allPinned =
                    pinnableParams.length > 0 &&
                    pinCount === pinnableParams.length;

                  return (
                    <>
                      {pinCount > 0 && (
                        <span className="text-[9px] text-amber-500 flex-shrink-0">
                          📌 {pinCount}
                        </span>
                      )}
                      {isExpanded && !node.isBound && pinnableParams.length > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (allPinned) {
                              handleUnpinAll(node);
                            } else {
                              handlePinAll(node);
                            }
                          }}
                          className={`flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded transition-colors ${
                            allPinned
                              ? "text-amber-400 hover:text-amber-300 hover:bg-amber-900/30"
                              : "text-neutral-500 hover:text-amber-400 hover:bg-amber-900/30"
                          }`}
                          title={
                            allPinned ? "Unpin all parameters" : "Pin all parameters"
                          }
                        >
                          {allPinned ? "Unpin all" : "Pin all"}
                        </button>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* パラメータ一覧 */}
              {isExpanded && (
                <div className="ml-6 mr-1 mb-1 space-y-0.5">
                  {loadingDefs.has(node.classType) && (
                    <div className="text-[10px] text-neutral-600 py-1 pl-2">
                      Fetching input definitions...
                    </div>
                  )}
                  {node.params.map((param) => {
                    const key = `${node.nodeId}:${param.paramName}`;
                    const isPinned = pinnedKeys.has(key);
                    const def = (inputDefs[node.classType] ?? []).find(
                      (d) => d.paramName === param.paramName,
                    );

                    return (
                      <div
                        key={param.paramName}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${
                          isPinned
                            ? "bg-amber-900/20 border border-amber-800/30"
                            : "hover:bg-neutral-800/50"
                        }`}
                      >
                        {/* パラメータ名 */}
                        <span
                          className={`flex-shrink-0 min-w-0 truncate ${
                            isPinned ? "text-amber-400" : "text-neutral-400"
                          }`}
                          style={{ maxWidth: "120px" }}
                          title={param.paramName}
                        >
                          {param.paramName}
                        </span>
                        {/* 値 */}
                        <span className="flex-1 text-neutral-500 font-mono text-[10px] truncate text-right">
                          {formatParamValue(param.value)}
                        </span>
                        {/* min/max or options count (取得済みの場合) */}
                        {def && def.options && def.options.length > 0 ? (
                          <span className="flex-shrink-0 text-[9px] text-neutral-700" title={`${def.options.length} options`}>
                            ▾{def.options.length}
                          </span>
                        ) : def && (def.min !== undefined || def.max !== undefined) ? (
                          <span className="flex-shrink-0 text-[9px] text-neutral-700" title="min–max range">
                            [{def.min ?? "?"} – {def.max ?? "?"}]
                          </span>
                        ) : null}
                        {/* ピン/解除ボタン */}
                        {node.isBound ? (
                          <span className="flex-shrink-0 w-5 text-center text-neutral-700 text-[10px]" title="Controlled by Siglane editor">
                            —
                          </span>
                        ) : (
                          <button
                            onClick={() =>
                              isPinned
                                ? handleUnpin(node.nodeId, param.paramName)
                                : handlePin(node, param)
                            }
                            className={`flex-shrink-0 w-5 text-center transition-colors ${
                              isPinned
                                ? "text-amber-500 hover:text-amber-300"
                                : "text-neutral-700 hover:text-amber-500"
                            }`}
                            title={isPinned ? "Unpin" : "Pin to Generate panel"}
                          >
                            📌
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatParamValue(value: unknown): string {
  if (typeof value === "number") {
    // 小数点以下が長すぎる場合は4桁に丸める
    return Number.isInteger(value) ? String(value) : value.toFixed(4).replace(/\.?0+$/, "");
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") {
    return value.length > 20 ? value.slice(0, 20) + "…" : value;
  }
  return String(value);
}
