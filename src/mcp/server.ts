/**
 * T068 — Winddown MCP server.
 * Exposes two tools: analyze_company_site and prepare_dissolution.
 * Certification is human-only and is NOT exposed as a tool parameter.
 *
 * Start: pnpm mcp:start
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAnalyzeCompanySite } from "./tools/analyze-company-site.js";
import { registerPrepareDissoluation } from "./tools/prepare-dissolution.js";

const server = new McpServer({
  name: "winddown",
  version: "0.1.0",
});

registerAnalyzeCompanySite(server);
registerPrepareDissoluation(server);

const transport = new StdioServerTransport();
await server.connect(transport);
