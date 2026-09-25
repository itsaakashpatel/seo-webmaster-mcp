#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SERVER_NAME, SERVER_VERSION } from "./core/constants.js";
import { registerAllTools } from "./tools/index.js";

async function main(): Promise<void> {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  registerAllTools(server);
  await server.connect(new StdioServerTransport());
  // stdout carries the MCP protocol, so log to stderr.
  console.error("SEO & Webmaster MCP server running on stdio");
}

main().catch((error: unknown) => {
  console.error("Fatal error starting SEO & Webmaster MCP server:", error);
  process.exit(1);
});
