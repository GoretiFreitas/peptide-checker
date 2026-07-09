import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

function supabaseForUser(ctx: ToolContext) {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export default defineTool({
  name: "nominate_product",
  title: "Nominate a product for independent testing",
  description:
    "Nominate a peptide product to be tested independently by the cooperative. Creates a new board item in the 'nominated' state, owned by the signed-in user.",
  inputSchema: {
    product_name: z.string().min(2).max(200).describe("Product / peptide name."),
    seller: z.string().max(200).default("").describe("Seller or vendor name."),
    source_url: z.string().url().optional().describe("Optional product page URL."),
    description: z.string().max(2000).optional().describe("Optional context or reason."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ product_name, seller, source_url, description }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const { data, error } = await supabaseForUser(ctx)
      .from("board_items")
      .insert({
        product_name,
        seller,
        source_url: source_url || null,
        description: description || null,
        state: "nominated",
        nominated_by: ctx.getUserId(),
      })
      .select()
      .single();
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: `Nominated: ${data.id}` }],
      structuredContent: { item: data },
    };
  },
});
