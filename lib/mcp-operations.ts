/**
 * MCP 操作模块 - 处理图表创建和编辑操作
 */

import { mcpClient } from "./mcp-client";
import {
  extractMxCells,
  wrapXmlContent,
  wrapAsMxGraphModel,
  validateMxCellXml,
  extractMxGraphModelFromResponse,
} from "./xml-utils";

export interface McpResult {
  content?: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

export interface DiagramResult {
  success: boolean;
  xml?: string;
  error?: string;
}

/**
 * 从 MCP 结果中提取错误文本
 */
function extractErrorText(result: McpResult): string {
  return result.content?.find((c) => c.type === "text")?.text || "未知错误";
}

/**
 * 处理 display_diagram 工具调用 - 创建新图表
 */
export async function handleDisplayDiagram(xml: string): Promise<DiagramResult> {
  // 验证 XML 格式
  const xmlValidation = validateMxCellXml(xml);
  if (!xmlValidation.valid) {
    console.error("XML validation failed:", xmlValidation.error);
    return {
      success: false,
      error: `生成的 XML 格式错误: ${xmlValidation.error}。请重试。`,
    };
  }

  try {
    // 确保 MCP 会话已启动
    await mcpClient.ensureSession();

    // 包装成完整的 mxGraphModel XML
    const mxGraphModelXml = wrapAsMxGraphModel(xml);

    const result = (await mcpClient.callTool("create_new_diagram", {
      xml: mxGraphModelXml,
    })) as McpResult;

    console.log("MCP create_new_diagram result:", result);

    if (result.isError) {
      const errorText = extractErrorText(result);
      console.error("MCP create_new_diagram error:", errorText);
      return {
        success: false,
        error: `创建图表失败: ${errorText}`,
      };
    }

    const finalXml = wrapXmlContent(xml);
    return {
      success: true,
      xml: finalXml,
    };
  } catch (mcpError) {
    console.error("MCP call failed:", mcpError);
    return {
      success: false,
      error: `MCP 调用失败: ${(mcpError as Error).message}`,
    };
  }
}

export interface EditOperation {
  operation: string;
  cell_id?: string;
  new_xml?: string;
}

/**
 * 处理 edit_diagram 工具调用 - 编辑现有图表
 */
export async function handleEditDiagram(
  operations: EditOperation[],
  currentXml: string | null
): Promise<DiagramResult> {
  // 如果没有现有图表，但所有操作都是 add，自动转换为创建新图表
  if (!currentXml) {
    const allAdds = operations.every((op) => op.operation === "add");

    if (allAdds && operations.length > 0) {
      console.log(
        "No existing diagram but all operations are 'add', converting to display_diagram..."
      );

      // 提取所有 add 操作的 new_xml 并合并
      const combinedXml = operations
        .map((op) => op.new_xml || "")
        .filter((xml) => xml.trim())
        .join("\n");

      if (combinedXml) {
        return handleDisplayDiagram(combinedXml);
      }
    }

    return {
      success: false,
      error: "没有找到要编辑的图表，请先创建一个图表。",
    };
  }

  try {
    await mcpClient.ensureSession();

    // 必须先调用 get_diagram 获取最新状态
    console.log("Calling get_diagram before edit_diagram...");
    const getDiagramResult = await mcpClient.callTool("get_diagram", {});
    console.log("get_diagram result:", getDiagramResult);

    const result = (await mcpClient.callTool("edit_diagram", {
      operations: operations,
    })) as McpResult;

    console.log("MCP edit_diagram result:", result);

    if (result.isError) {
      const errorText = extractErrorText(result);
      console.error("MCP edit_diagram error:", errorText);
      return {
        success: false,
        error: `编辑图表失败: ${errorText}`,
      };
    }

    // 获取编辑后的最新 XML
    const getResult = (await mcpClient.callTool("get_diagram", {})) as McpResult;
    const responseText = getResult.content?.find((c) => c.type === "text")?.text || "";

    // MCP 服务器返回格式是 "Current diagram XML:\n\n<mxGraphModel>..."
    // 需要提取实际的 XML 内容
    const mxGraphModel = extractMxGraphModelFromResponse(responseText);
    const updatedXml = mxGraphModel
      ? wrapXmlContent(extractMxCells(mxGraphModel))
      : currentXml;

    return {
      success: true,
      xml: updatedXml,
    };
  } catch (mcpError) {
    console.error("MCP call failed:", mcpError);
    return {
      success: false,
      error: `MCP 调用失败: ${(mcpError as Error).message}`,
    };
  }
}
