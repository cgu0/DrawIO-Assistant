"use client";

import { useRef, useCallback, useState, useEffect, useMemo, memo } from "react";
import { DrawIoEmbed, DrawIoEmbedRef, EventExport } from "react-drawio";
import { sanitizeDiagramXml } from "@/lib/sanitize-drawio-edges";

interface DrawIOEditorProps {
  xml: string;
  onXmlChange?: (xml: string) => void;
  onExport?: (data: { xml: string; svg?: string }) => void;
}

// 检查 XML 是否有效（包含实际的图表内容）
function isValidDiagramXml(xml: string): boolean {
  if (!xml || !xml.trim()) return false;
  return xml.includes("<mxCell") || xml.includes("<mxfile");
}

function DrawIOEditorInner({ xml, onXmlChange, onExport }: DrawIOEditorProps) {
  const drawioRef = useRef<DrawIoEmbedRef>(null);
  const [isReady, setIsReady] = useState(false);
  const prevXmlRef = useRef<string>("");
  const initialLoadDoneRef = useRef(false);

  // 检查是否有有效的 XML（直接用 prop，不 sanitize）
  const hasValidXml = useMemo(() => isValidDiagramXml(xml), [xml]);

  // 当外部 xml prop 变化时更新编辑器（只在初始加载完成后）
  useEffect(() => {
    if (initialLoadDoneRef.current && xml !== prevXmlRef.current && drawioRef.current && isReady) {
      drawioRef.current.load({ xml });
      prevXmlRef.current = xml;
    }
  }, [xml, isReady]);

  // 导出时才进行 sanitize
  const handleExport = useCallback((data: EventExport) => {
    if (data.data) {
      let exportedXml = "";

      if (data.format === "xmlsvg" && data.data.startsWith("data:image/svg+xml;base64,")) {
        const base64 = data.data.replace("data:image/svg+xml;base64,", "");
        const svgContent = atob(base64);

        const contentMatch = svgContent.match(/content="([^"]+)"/);
        if (contentMatch) {
          exportedXml = contentMatch[1]
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, "&");
        }

        // 导出时进行 sanitize
        const sanitizedXml = sanitizeDiagramXml(exportedXml);
        onExport?.({ xml: sanitizedXml, svg: svgContent });
      } else if (data.xml) {
        const sanitizedXml = sanitizeDiagramXml(data.xml);
        onExport?.({ xml: sanitizedXml });
      }
    }
  }, [onExport]);

  // 保存时不 sanitize，直接传递
  // 只有当 XML 真正变化时才调用 onXmlChange，避免不必要的状态更新
  const handleSave = useCallback((data: { xml: string }) => {
    if (data.xml !== prevXmlRef.current) {
      prevXmlRef.current = data.xml;
      onXmlChange?.(data.xml);
    }
  }, [onXmlChange]);

  const exportDiagram = useCallback(() => {
    if (drawioRef.current) {
      drawioRef.current.exportDiagram({ format: "xmlsvg" });
    }
  }, []);

  // 如果没有有效的 XML，显示占位符
  if (!hasValidXml) {
    return (
      <div className="drawio-editor-container">
        <div className="editor-placeholder">
          <p>等待流程图数据...</p>
        </div>
        <style jsx>{`
          .drawio-editor-container {
            border: 1px solid #e5e5e5;
            border-radius: 12px;
            overflow: hidden;
            background: white;
            margin-top: 8px;
          }
          .editor-placeholder {
            height: 200px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #8e8e8e;
            background: #fafafa;
            font-size: 14px;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="drawio-editor-container">
      <div className="toolbar">
        <div className="toolbar-left">
          <button onClick={exportDiagram} className="export-btn" disabled={!isReady}>
            导出 SVG
          </button>
        </div>
        <span className="status">
          {isReady ? "✓ 编辑器就绪 - 可直接修改形状和箭头" : "加载中..."}
        </span>
      </div>

      <div className="editor-wrapper">
        <DrawIoEmbed
          ref={drawioRef}
          urlParameters={{
            ui: "kennedy",
            spin: true,
            libraries: false,
            saveAndExit: false,
            noSaveBtn: true,
            noExitBtn: true,
          }}
          onLoad={() => {
            // 只在第一次加载时执行
            if (initialLoadDoneRef.current) {
              return;
            }
            setIsReady(true);
            // 在 iframe 完全准备好后再加载 XML
            if (drawioRef.current && xml) {
              setTimeout(() => {
                drawioRef.current?.load({ xml });
                prevXmlRef.current = xml;
                initialLoadDoneRef.current = true;
              }, 100);
            } else {
              initialLoadDoneRef.current = true;
            }
          }}
          onSave={handleSave}
          onExport={handleExport}
        />
      </div>

      <style jsx>{`
        .drawio-editor-container {
          border: 1px solid #e5e5e5;
          border-radius: 12px;
          overflow: hidden;
          background: white;
          margin-top: 8px;
          height: clamp(400px, 60vh, 70vh);
          display: flex;
          flex-direction: column;
          overscroll-behavior: contain;
        }
        .toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 16px;
          background: #fafafa;
          border-bottom: 1px solid #e5e5e5;
        }
        .toolbar-left {
          display: flex;
          gap: 8px;
        }
        .export-btn {
          padding: 6px 14px;
          border: none;
          border-radius: 8px;
          background: #0d0d0d;
          color: white;
          cursor: pointer;
          font-size: 13px;
          font-family: inherit;
          font-weight: 500;
          transition: background-color 0.15s ease;
        }
        .export-btn:hover:not(:disabled) {
          background: #2d2d2d;
        }
        .export-btn:disabled {
          background: #e0e0e0;
          color: #a0a0a0;
          cursor: not-allowed;
        }
        .export-btn:focus-visible {
          outline: 2px solid #555;
          outline-offset: 2px;
        }
        .status {
          font-size: 12px;
          color: #8e8e8e;
        }
        .editor-wrapper {
          flex: 1;
          min-height: 300px;
          width: 100%;
        }
        .editor-wrapper :global(iframe) {
          width: 100%;
          height: 100%;
          border: none;
          touch-action: none;
        }
        @media (max-width: 640px) {
          .drawio-editor-container {
            height: clamp(300px, 50vh, 60vh);
          }
          .editor-wrapper {
            min-height: 250px;
          }
        }
      `}</style>
    </div>
  );
}

// 使用 memo 包装，只有当 xml 真正变化时才重新渲染
export const DrawIOEditor = memo(DrawIOEditorInner, (prevProps, nextProps) => {
  // 返回 true 表示 props 相同，不需要重新渲染
  return prevProps.xml === nextProps.xml;
});
