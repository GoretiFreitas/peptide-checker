// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

// Publishable (anon) backend config. Inlined explicitly so a production build
// never ships a bundle missing these values, even if .env is absent at build time.
const SUPABASE_URL = "https://dagavnilqwvgvvlkzfyr.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhZ2F2bmlscXd2Z3Z2bGt6ZnlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MTY2OTUsImV4cCI6MjA5OTE5MjY5NX0.KQddrAxraxdCZR2Jvn_pXWl4Tsz3ThvXCkbg7yRGyMw";
const SUPABASE_PROJECT_ID = "dagavnilqwvgvvlkzfyr";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [mcpPlugin()],
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
        process.env.VITE_SUPABASE_URL || SUPABASE_URL,
      ),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY || SUPABASE_PUBLISHABLE_KEY,
      ),
      "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(
        process.env.VITE_SUPABASE_PROJECT_ID || SUPABASE_PROJECT_ID,
      ),
    },
  },
});

