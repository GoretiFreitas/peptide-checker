import { createStart } from "@tanstack/react-start";
import { attachSupabaseAuth, errorMiddleware } from "@/backend/middleware";

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware],
}));
