/**
 * XML 工具函数 - 处理 draw.io XML 格式
 */

/**
 * 从 mxGraphModel XML 中提取 mxCell 元素（排除 id="0" 和 id="1"）
 */
export function extractMxCells(mxGraphModelXml: string): string {
  // 匹配所有 mxCell 元素（包括自闭合和非自闭合）
  const cellPattern = /<mxCell[^>]*(?:\/>|>[\s\S]*?<\/mxCell>)/g;
  const cells: string[] = [];

  let match;
  while ((match = cellPattern.exec(mxGraphModelXml)) !== null) {
    const cell = match[0];
    // 排除 id="0" 和 id="1" 的根元素
    if (!cell.includes('id="0"') && !cell.includes('id="1"')) {
      cells.push(cell);
    }
  }

  return cells.join("\n");
}

/**
 * 将 mxCell 元素包装成完整的 draw.io XML
 */
export function wrapXmlContent(mxCellsXml: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net" modified="${new Date().toISOString()}" agent="DrawIO Chatbot" version="1.0">
  <diagram name="Page-1" id="page1">
    <mxGraphModel dx="0" dy="0" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="0" pageScale="1" pageWidth="1600" pageHeight="1200" background="none">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        ${mxCellsXml}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;
}

/**
 * 将 mxCell 元素包装成 mxGraphModel XML（用于 MCP 调用）
 */
export function wrapAsMxGraphModel(mxCellsXml: string): string {
  return `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${mxCellsXml}</root></mxGraphModel>`;
}

export interface XmlValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * 验证 mxCell XML 格式是否正确
 */
export function validateMxCellXml(xml: string): XmlValidationResult {
  if (!xml || !xml.trim()) {
    return { valid: false, error: "XML 内容为空" };
  }

  const openTags = (xml.match(/<mxCell[^/>]*>/g) || []).length;
  const closeTags = (xml.match(/<\/mxCell>/g) || []).length;

  if (openTags !== closeTags) {
    return {
      valid: false,
      error: `mxCell 标签未正确关闭：发现 ${openTags} 个开始标签，${closeTags} 个结束标签`,
    };
  }

  // 简单的嵌套检查
  try {
    const testXml = `<root>${xml}</root>`;
    let depth = 0;
    const tagRegex = /<\/?[a-zA-Z][^>]*\/?>/g;
    let match;
    while ((match = tagRegex.exec(testXml)) !== null) {
      const tag = match[0];
      if (tag.startsWith("</")) {
        depth--;
      } else if (!tag.endsWith("/>")) {
        depth++;
      }
      if (depth < 0) {
        return { valid: false, error: "XML 标签嵌套错误" };
      }
    }
    if (depth !== 0) {
      return { valid: false, error: `XML 标签未正确关闭，嵌套深度: ${depth}` };
    }
  } catch (e) {
    return { valid: false, error: `XML 解析错误: ${(e as Error).message}` };
  }

  return { valid: true };
}

/**
 * 从 MCP 响应中提取 mxGraphModel XML
 */
export function extractMxGraphModelFromResponse(responseText: string): string | null {
  const xmlMatch = responseText.match(/<mxGraphModel[\s\S]*<\/mxGraphModel>/);
  return xmlMatch ? xmlMatch[0] : null;
}

/**
 * 清理 LLM 可能输出的 JSON 内容
 */
export function cleanLlmContent(content: string | null | undefined): string {
  if (!content) return "";
  const trimmed = content.trim();
  // 如果内容看起来像 JSON 对象/数组，忽略它
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    return "";
  }
  return content;
}
