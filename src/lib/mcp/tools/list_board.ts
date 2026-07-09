import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export default defineTool({
  name: "list_board",
  title: "List testing board items",
  description:
    "List community testing board items — peptide products nominated for independent testing, with their state and current funding.",
  inputSchema: {
    state: z
      .enum(["nominated", "funding", "testing", "published", "cancelled"])
      .optional()
      .describe("Optional filter for the item state."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ state }) => {
    const sb = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    let q = sb.from("board_items").select("*").order("created_at", { ascending: false });
    if (state) q = q.eq("state", state);
    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { items: data ?? [] },
    };
  },
});
