import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

// TODO: replace with your project URL once a project name or custom domain is set.
const BASE_URL = "";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/fund", changefreq: "daily", priority: "0.9" },
          { path: "/fund/nominate", changefreq: "monthly", priority: "0.6" },
          { path: "/support", changefreq: "monthly", priority: "0.6" },
        ];

        // Include published registry reports.
        try {
          const { createClient } = await import("@supabase/supabase-js");
          const sb = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_PUBLISHABLE_KEY!,
            { auth: { persistSession: false, autoRefreshToken: false } },
          );
          const { data: items } = await sb
            .from("board_items")
            .select("id, state, updated_at");
          for (const it of items ?? []) {
            entries.push({ path: `/fund/${it.id}`, changefreq: "weekly", priority: "0.6" });
            if (it.state === "published") {
              entries.push({ path: `/registry/${it.id}`, changefreq: "monthly", priority: "0.7" });
            }
          }
        } catch {
          // Best effort — omit dynamic entries if the DB is unavailable.
        }

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
