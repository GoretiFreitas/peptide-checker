
# PeptidesCheck improvement plan

Scope: edit the existing site. Keep the tool, the board, and the support pages. No em-dashes, spell out acronyms on first use, and never invent lab partners or metrics.

## 1. Unified brand identity
- Header wordmark becomes "PeptidesCheck, by Descier Science." Remove "Knowledge Orchestration" everywhere (`SiteHeader.tsx`, footer, any meta tags).
- Footer brand line: "PeptidesCheck, by Descier Science. Copyright 2026." Replace "Descier Cooperative" wording. Keep Reddit, X (@desciers), and peptides@descier.science.
- Update route `<head>` titles/descriptions across `index.tsx`, `board.*`, `support.tsx`, `registry.*`, `admin.tsx`, `auth.tsx` to use PeptidesCheck.

## 2. Homepage hero rewrite (`src/routes/index.tsx`)
- H1 "PeptidesCheck."
- Subhead: "Read a peptide Certificate of Analysis (COA) and see, field by field, what the document actually reports, what it leaves out, and whether it can be trusted."
- Primary CTA "Check a certificate" scrolls to the inputs.
- Trust line: "Independent and community-supported. No login, and no personal data stored."

## 3. Results panel improvements (`ResultsPanel.tsx`)
- Keep per-field green / amber / red status.
- Add a one-sentence overall summary at the top with caveats stated inline.
- Promote missing sterility or endotoxin testing to a prominent red callout above the fields list.
- Add a shareable verifiable result link that points at the Authenticity Register entry (section 6) once the certificate is registered.

## 4. New homepage sections (below the tool)
- "What we check": purity claim vs stated method; sequence / mass / batch consistency; presence of sterility and endotoxin testing; identity and impurities; signs of reused, templated, or forged certificates.
- "How it works": document parsed by an artificial intelligence (AI) reader, deterministic rule-based scoring on top, cross-reference against the Authenticity Register. Mark heuristic checks as heuristic.
- "What a certificate review can and cannot tell you" callout: paper not vial, purity not safety, injectables need independent lab testing.
- "Who this is for": researchers, clinics, compounders, distributors, buyers.
- "Next step": link to the board and to support.
- "Trust and independence": run by Descier Science, community-supported, no named lab partners unless real (leave blank for now).

## 5. Authenticity Register (new feature)
New Supabase table `certificate_register`, append-only:
- `id`, `sha256` (unique), `batch_id`, `product_name`, `sequence`, `purity_percent`, `issuing_lab`, `issue_date`, `first_seen_at`, `seen_count`.
- Row Level Security: public SELECT, INSERT only via a `SECURITY INVOKER` server function; no UPDATE or DELETE policy for anyone (append-only enforced by absence of policies plus a trigger that blocks UPDATE/DELETE).
- GRANTs: SELECT to anon and authenticated; INSERT to authenticated and anon via server function only.

Client-side SHA-256 hashing of the raw text or file bytes with `crypto.subtle.digest` before submission. After a check completes, a server function `registerCertificate` upserts by hash (increments `seen_count` on repeat) and returns the register entry.

New route `/verify` with a lookup form:
- Input: batch number or SHA-256 hash.
- Server function `lookupRegister` returns one of "Registered and unaltered", "Seen before under a different batch", or "Not in the register."
- Deep-linkable result URL `/verify?hash=…` for shareable proof.

Note: the plan says "share register data model with the Trusted verification site and the Evidence Register application." Those systems are not in this codebase. I will build the schema so it is portable (stable column names, hash as the natural key), but I will not attempt cross-project sync in this pass. Flag if you want a shared Supabase project instead.

## 6. English / Portuguese language toggle
- Add a lightweight i18n layer: a `useLocale()` hook backed by `localStorage`, a small `t(key)` dictionary in `src/lib/i18n/{en,pt}.ts` covering the homepage copy, results labels, register copy, footer, and consent text.
- Toggle in the header (EN | PT). No route changes.

## 7. Consent and legal
- Consent checkbox on the nomination form and on any future batch-testing request form, worded for the Lei Geral de Proteção de Dados (LGPD) and the General Data Protection Regulation (GDPR). Checker and verifier stay no-login and store no personal data.
- Keep the molecular-biology-grade research-only disclaimer in the footer.

## 8. Optional CRM webhook (stub)
Add a server-side `POST` handler under `src/routes/api/public/testing-request.ts` that validates a batch-testing payload and, if `CRM_WEBHOOK_URL` env is set, forwards it. No-op if unset. No client form yet; the endpoint is groundwork.

## 9. Housekeeping
- Grep for "Cooperative", "Knowledge Orchestration", em-dashes ("—") in user-visible copy and replace. Code comments left alone.
- Softens footer "testing of research peptides" to "certificate review and authenticity, plus a community board that funds independent laboratory testing."

## Out of scope
- Cross-project register sharing with Trusted / Evidence Register apps.
- Adding real lab partners or testimonials.
- Any change to Stripe, board funding math, or admin flows.

## Technical notes
- Migration for `certificate_register` will include CREATE TABLE, GRANTs, ENABLE RLS, SELECT policy for anon+authenticated, and a `BEFORE UPDATE OR DELETE` trigger that raises to enforce append-only.
- Hashing runs in the browser; the server re-hashes on submission and rejects mismatches to prevent spoofed hashes.
- i18n stays local (no external library) to avoid Worker-runtime issues.

## Questions before I start
1. Portuguese copy: should I machine-translate the English strings myself, or do you want to supply the PT translations?
2. Register scope: hash the raw certificate text/file bytes only, or also normalize (strip whitespace) so trivially reformatted duplicates still collide? I recommend both — store raw hash and normalized hash.
3. CRM webhook: leave as an env-gated stub for now, or skip entirely until you have a CRM chosen?
