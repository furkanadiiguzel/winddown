/**
 * T069 — analyze_company_site MCP tool.
 *
 * Calls scrape() and extract() directly (not via HTTP) so that SSRF guard,
 * robots.txt checks, page/size/timeout caps, and no-content-logging invariants
 * fire through the shared functions — NOT duplicated in MCP middleware.
 *
 * Tool does NOT accept or set certificationAffirmed.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { scrape } from "@/lib/scraper/index.js";
import { extract } from "@/lib/extractor/index.js";

export function registerAnalyzeCompanySite(server: McpServer) {
  server.registerTool(
    "analyze_company_site",
    {
      title: "Analyse Company Website",
      description:
        "Fetches and analyses a company website to extract fields needed for a Wyoming dissolution form. " +
        "Returns an ExtractionResult with extracted values, confidence levels, and evidence snippets. " +
        "This tool does NOT handle certification — that step must be completed by an authorised human signatory.",
      inputSchema: {
        url: z.string().url().describe("The company website URL (must be HTTPS)."),
      },
    },
    async ({ url }) => {
      // SSRF guard, robots.txt, tier-1/tier-2 scraping, pruning all happen inside scrape()
      const scrapeResult = await scrape(url);

      if (scrapeResult.errorClass) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: scrapeResult.errorClass,
                message: "Scraping failed. The user should enter details manually.",
              }),
            },
          ],
          isError: true,
        };
      }

      const extractionResult = await extract(scrapeResult);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(extractionResult),
          },
        ],
      };
    }
  );
}
