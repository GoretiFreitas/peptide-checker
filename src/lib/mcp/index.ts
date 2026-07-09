import { auth, defineMcp } from "@lovable.dev/mcp-js";
import checkCertificate from "./tools/check_certificate";
import listBoard from "./tools/list_board";
import nominateProduct from "./tools/nominate_product";
import myPledges from "./tools/my_pledges";

// OAuth issuer MUST be the direct Supabase host. On publish, SUPABASE_URL is
// rewritten to a proxy which mcp-js rejects (RFC 8414 issuer mismatch). The
// project ref survives publish unchanged.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "certificate-checker-mcp",
  title: "Certificate Checker",
  version: "0.1.0",
  instructions:
    "Tools for the peptide Certificate Checker: analyze a Certificate of Analysis, browse the community testing board, nominate a product, and review your pledges.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [checkCertificate, listBoard, nominateProduct, myPledges],
});
