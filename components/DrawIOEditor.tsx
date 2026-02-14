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
      <div className="border border-[#e5e5e5] rounded-xl overflow-hidden bg-white mt-2">
        <div className="h-[200px] flex items-center justify-center text-[#8e8e8e] bg-[#fafafa] text-sm">
          <p>等待流程图数据...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-[#e5e5e5] rounded-xl overflow-hidden bg-white mt-2 h-[clamp(400px,60vh,70vh)] flex flex-col max-sm:h-[clamp(300px,50vh,60vh)]" style={{ overscrollBehavior: "contain" }}>
      <div className="flex justify-between items-center px-4 py-2.5 bg-[#fafafa] border-b border-[#e5e5e5]">
        <div className="flex gap-2">
          <button
            onClick={exportDiagram}
            className="px-3.5 py-1.5 border-none rounded-lg bg-[#0d0d0d] text-white cursor-pointer text-[13px] font-[inherit] font-medium transition-colors hover:bg-[#2d2d2d] disabled:bg-[#e0e0e0] disabled:text-[#a0a0a0] disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-[#555] focus-visible:outline-offset-2"
            disabled={!isReady}
          >
            导出 SVG
          </button>
        </div>
        <span className="text-xs text-[#8e8e8e]">
          {isReady ? "✓ 编辑器就绪 - 可直接修改形状和箭头" : "加载中..."}
        </span>
      </div>

      <div className="flex-1 min-h-[300px] w-full max-sm:min-h-[250px] [&_iframe]:w-full [&_iframe]:h-full [&_iframe]:border-none" style={{ touchAction: "none" }}>
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
            if (initialLoadDoneRef.current) {
              return;
            }
            setIsReady(true);
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
    </div>
  );
}

// 使用 memo 包装，只有当 xml 真正变化时才重新渲染
export const DrawIOEditor = memo(DrawIOEditorInner, (prevProps, nextProps) => {
  return prevProps.xml === nextProps.xml;
});
