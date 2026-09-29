/** The text-only subset of an MCP `CallToolResult` that every tool returns. */
export interface ToolResult {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export function okText(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}

export function errText(text: string): ToolResult {
  return { isError: true, content: [{ type: "text", text }] };
}
