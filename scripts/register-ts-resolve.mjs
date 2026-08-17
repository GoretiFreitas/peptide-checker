// Entry point for `node --import`: registers the resolution hook on the
// module-loader thread. Must be separate from the hook itself.
import { register } from "node:module";

register("./ts-resolve-hook.mjs", import.meta.url);
