// Module-resolution hook for Node's built-in test runner.
//
// Node strips TypeScript types natively, but its ESM resolver still requires a
// real file path. Source in this project uses extensionless relative imports
// ("./certificate-types") and the "@/" alias from tsconfig, so map both here.
// Kept dependency-free on purpose: adding a test runner would mean a
// package.json change that cannot be reflected in bun.lock from this machine.
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = path.join(projectRoot, "src");

const CANDIDATE_SUFFIXES = [".ts", ".tsx", ".js", ".mjs", "/index.ts", "/index.tsx"];

function firstExisting(basePath) {
  for (const suffix of CANDIDATE_SUFFIXES) {
    const candidate = `${basePath}${suffix}`;
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  let request = specifier;

  // "@/lib/scoring" -> "<root>/src/lib/scoring"
  if (request.startsWith("@/")) {
    const aliased = path.join(srcRoot, request.slice(2));
    const resolved = existsSync(aliased) ? aliased : firstExisting(aliased);
    if (resolved) return nextResolve(pathToFileURL(resolved).href, context);
  }

  try {
    return await nextResolve(request, context);
  } catch (error) {
    if (error?.code !== "ERR_MODULE_NOT_FOUND" && error?.code !== "ERR_UNSUPPORTED_DIR_IMPORT") {
      throw error;
    }

    // Retry an extensionless relative import against real files on disk.
    if (!request.startsWith(".") || !context.parentURL) throw error;

    const parentDir = path.dirname(fileURLToPath(context.parentURL));
    const resolved = firstExisting(path.resolve(parentDir, request));
    if (!resolved) throw error;

    return nextResolve(pathToFileURL(resolved).href, context);
  }
}
