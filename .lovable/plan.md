# Certificate Checker

A single-page tool that reads a peptide certificate of analysis (image, PDF, or pasted text), transcribes the reported fields with Gemini, then applies **deterministic code** to score fields, raise flags, and produce one of four fixed verdicts — with a permanent disclaimer. No accounts, no personal data.

## Design

Plain and trustworthy. Warm off-white background, near-black text, muted taupe borders, one soft neutral action button. Serif display heading, sans body, uppercase micro-labels with wide tracking. No gradients, no bright colors, no marketing language.

Layout (desktop): left rail with heading + short blurb + submit button pinned at the bottom; right side has two dashed-border cards side-by-side (file upload / raw text) and a tall dashed results card underneath. Mobile stacks vertically.

## Build steps

### Step 1 — Static shell

- Replace `src/routes/index.tsx` placeholder with the checker page.
- Components in `src/components/checker/`: `Sidebar`, `FileDropzone` (accepts image/* and application/pdf, 12MB cap, drag+drop, filename chip), `RawTextInput` (textarea), `ResultsPanel`.
- "Check certificate" button disabled until file or text is provided; on click, reveals an empty results area with "Analysis results pending".
- Update `__root.tsx` head: title "Certificate Checker", matching description + OG/Twitter (no og:image).

### Step 2 — Gemini extraction (transcription only)

- Ensure `LOVABLE_API_KEY` exists (`ai_gateway--create`).
- Server function `src/lib/extract-certificate.functions.ts` using `createServerFn` + `@ai-sdk/openai-compatible` provider (`https://ai.gateway.lovable.dev/v1`, header `Lovable-API-Key`), model `google/gemini-2.5-flash` (vision + PDF capable).
- Input: `{ text?: string, fileBase64?: string, fileMime?: string, fileName?: string }`. Client reads file with FileReader → base64 before submit.
- Multimodal message: `image_url` for images, `file` block with real MIME for PDFs, plain text otherwise.
- Prompt instructs Gemini to **read and transcribe only** — no judgment, no scoring — and return strict JSON with these fields (use exact string `"not reported"` when absent):
  - `productName`, `sequence`
  - `identity`: `{ result, method }`
  - `purity`: `{ percent (number|null), method, wavelength }`
  - `netPeptideContent`
  - `endotoxins`: `{ result, units }`
  - `sterility`
  - `elementalImpurities`
  - `residualSolvents`
  - `issuingLab`, `issueDate`, `batchId`
  - `rawNotes` (short verbatim quotes supporting each field)
- Structured output via `generateText` + `Output.object(zodSchema)`; wrap in `NoObjectGeneratedError` guard with graceful fallback.
- Handle 429 (rate limit) and 402 (credits) with user-facing messages.
- Render extracted fields in the results panel as a labelled list, with the verbatim `rawNotes` shown small under each field so the user can verify accuracy.

### Step 3 — Deterministic scoring (pure client code, not Gemini)

- New file `src/lib/scoring.ts` — pure functions, unit-testable, no AI.
- `scoreFields(extracted)` returns per-field results:
  - **Identity**: `pass` if method + result present and result mentions/matches `productName` or `sequence`; `fail` if result explicitly names a different peptide; `unknown` if `"not reported"`.
  - **Purity**: parse percent → `≥98` "pass (premium)", `95–<98` "pass (research grade)", `<95` "fail", null "unknown".
  - **Net peptide content, endotoxins, sterility, elemental impurities, residual solvents**: `"reported (value shown)"` if not `"not reported"`, else `"not tested"`.
  - Invariant: a `"not reported"` field NEVER becomes `pass`.
- `computeFlags(extracted, fieldResults)` returns `{ level: 'high'|'medium'|'low', message: string }[]`:
  - **Scope-overreach (high)**: purity percent present AND endotoxins, sterility, elementalImpurities, residualSolvents all `"not tested"` → message that the purity figure covers peptide-related impurities only and says nothing about contaminants relevant to injection.
  - **Missing-test (high each)**: identity / endotoxins / sterility each `"not tested"` → flag naming the level of verification that omission blocks (identity → "confirms the vial actually contains the named peptide"; endotoxins → "rules out pyrogenic contamination for injectable use"; sterility → "rules out microbial contamination").
  - **Provenance (medium)**: `issuingLab === "not reported"`.
  - **Consistency (high)**: identity result names a different peptide than `productName`/`sequence`.
- Render each flag with a colored dot for level and plain-language text.

### Step 4 — Verdict + mandatory disclaimer

- `computeVerdict(fieldResults, flags)` returns exactly one of:
  - `"Document review — consistent"` — identity `pass`, no high flags, all reported values meet thresholds. Rendered with subtitle "Based on the document only, not an independent test."
  - `"Document review — concerns"` — one or more medium/high flags but not a fail.
  - `"Failed"` — identity `fail`, or a reported contaminant exceeds its limit (endotoxin numeric > standard threshold — parsed from `endotoxins.result`).
  - `"Insufficient evidence"` — too few fields readable (e.g. `productName` and identity both `"not reported"`, or extraction returned mostly nulls).
- Results panel renders, in order: **verdict** (large), **per-field results** (labelled list with pass/fail/unknown badges), **flags** (grouped by importance), then a fixed bordered box with exactly:
  > "This describes what the certificate reports about the contents of a product. It is not a statement that the product is safe to inject or consume, or that it is effective or approved."
- No wording anywhere may imply the product is safe to use.

### Step 5 — Honest framing + nomination

- Short paragraph under the disclaimer: a document check is weaker than an independent test because a certificate can be faked or produced from a different batch than what shipped; the strongest check is independent testing of a product bought anonymously.
- Button **"Nominate this for independent testing"** → opens a small inline form (product name pre-filled from extraction, editable) → on submit stores to `localStorage` array `certificate-checker.nominations` and shows an inline thank-you message. No backend, no personal info collected.

## Technical

- Stack: TanStack Start, TanStack Query, Tailwind v4, shadcn primitives already available.
- New files:
  - `src/routes/index.tsx` (replace placeholder)
  - `src/components/checker/{Sidebar,FileDropzone,RawTextInput,ResultsPanel,VerdictBlock,FieldList,FlagsList,DisclaimerBox,NominateBlock}.tsx`
  - `src/lib/extract-certificate.functions.ts` (server fn)
  - `src/lib/ai-gateway.server.ts` (provider helper, per knowledge)
  - `src/lib/scoring.ts` (pure deterministic rules)
  - `src/lib/certificate-types.ts` (shared Zod schema + TS types)
- `__root.tsx` head updated for title/description/OG.
- Serif display font (Instrument Serif) + Inter loaded via `<link>` in root head.
- Design tokens tweaked in `src/styles.css` for warm off-white background and taupe borders (light-only rendering).

## Out of scope

- Auth, user accounts, saved history, admin dashboard, real independent-testing backend (nominations stored locally for now), payments.
  &nbsp;
  Design and Palette
  Update the visual design of the app to use this exact color system. Apply it consistently across every screen — do not introduce any other colors.
  Backgrounds and surfaces:
  - Page background: #FAF8F3 (a warm ivory, not white)
  - Cards and panels: #FFFFFF
  - Hairline borders and dividers: 0.5px solid #E7E3D8
  Text:
  - Primary text and headings: #1A1D23
  - Secondary and supporting text: #5F636B
  - Muted hints, timestamps, and batch identifiers: #8A8578
  Brand and actions:
  - Headers, the logo, and any strong emphasis: ink navy #1B2A4A
  - One accent color only, used sparingly for links, primary buttons, and active states: signal teal #0F7B6C. Buttons in teal use white text. Links are teal with no underline until hover.
  Verdict and status badges — use a pale fill with dark same-family text, never bright or saturated. Keep them calm and understated, like a measured finding rather than a marketing badge:
  - Verified: background #E7F1EA, text #1E5637
  - Concerns: background #FBF0DC, text #7A4E12
  - Failed: background #F7E4E1, text #7C271E
  - Funding or active: background #E4F1EE, text #0F5A4F
  - In progress or testing: background #FBF0DC, text #7A4E12
  - Nominated or neutral: background #EDEBE3, text #4A4842
  Typography and feel: clean, restrained, and precise, like a scientific journal or a lab report. No bright colors, no gradients, no shadows beyond a subtle card border. Sentence case everywhere. The overall impression should be calm, independent, and trustworthy — deliberately the opposite of a flashy sales page.
  Also add a dark mode using the same system: page background #14181F, cards #1C222C, hairlines #2C333F, primary text #ECEAE3, secondary text #A6ABB4, accent teal #3DA594. Keep the verdict badges legible by using darker fills with the same-family light text. Let the app follow the device's light or dark setting automatically.
  Keep all existing functionality and layout unchanged — this update is only colors, typography, and styling.