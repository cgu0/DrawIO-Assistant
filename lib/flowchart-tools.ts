/**
 * Azure OpenAI Tool 定义
 * LLM 直接生成 draw.io XML 的新架构
 */

import type { ChatCompletionTool } from "openai/resources/chat/completions";

export const flowchartTools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "display_diagram",
      description: `Display a NEW diagram on draw.io. Use this when creating a diagram from scratch or when major structural changes are needed.

IMPORTANT: Generate ONLY mxCell elements - NO wrapper tags like <mxfile>, <mxGraphModel>, or <root>. The wrapper is added automatically.

Example output:
<mxCell id="2" value="Start" style="ellipse;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;" vertex="1" parent="1">
  <mxGeometry x="340" y="40" width="120" height="60" as="geometry"/>
</mxCell>
<mxCell id="3" value="Process" style="rounded=1;whiteSpace=wrap;html=1;" vertex="1" parent="1">
  <mxGeometry x="340" y="140" width="120" height="60" as="geometry"/>
</mxCell>`,
      parameters: {
        type: "object",
        properties: {
          xml: {
            type: "string",
            description:
              "The mxCell elements to display. Generate ONLY mxCell elements, no wrapper tags. Use unique IDs starting from 2.",
          },
        },
        required: ["xml"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "edit_diagram",
      description: `Edit specific parts of the EXISTING diagram. Use this when making small targeted changes like adding/removing elements, changing labels, colors, or positions.

Operations:
- update: Replace an existing cell. Provide cell_id and new_xml (complete mxCell element).
- add: Add a new cell. Provide cell_id (new unique id) and new_xml.
- delete: Remove a cell by id. Cascade is automatic (children and connected edges are also deleted).

IMPORTANT: JSON escape all quotes in new_xml with \\"`,
      parameters: {
        type: "object",
        properties: {
          operations: {
            type: "array",
            description: "List of edit operations to perform",
            items: {
              type: "object",
              properties: {
                operation: {
                  type: "string",
                  enum: ["update", "add", "delete"],
                  description: "The type of operation",
                },
                cell_id: {
                  type: "string",
                  description: "The ID of the cell to operate on",
                },
                new_xml: {
                  type: "string",
                  description:
                    "Complete mxCell element for update/add operations. Not needed for delete.",
                },
              },
              required: ["operation", "cell_id"],
            },
          },
        },
        required: ["operations"],
      },
    },
  },
];

