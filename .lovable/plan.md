## Goal
Expand `/board` into a richer crowdfunded testing board with two lab variants (Janoshik, Finnrick), tier-unlock ladders, backer avatars, a results panel, and a "How funding targets are set" reference — while keeping the existing DB-backed pledge + Stripe manual-capture flow already wired up in `src/lib/board.functions.ts` and the webhook.

## Scope
Frontend + light schema additions. No changes to Stripe integration, auth, or webhook logic.

## 1. Schema additions (migration)
Extend `board_items` with:
- `lab` text — `'janoshik' | 'finnrick'`
- `us_only` boolean (Finnrick campaigns)
- `thumbnail_url` text
- `deadline` timestamptz (already have `funding_deadline`; reuse)
- `coa_url` text — link to lab's public report when results publish

Extend `board_stretch_goals` (already exists) usage:
- Treat as ordered tiers with `name`, `threshold_cents`, plus derived `unlocked` from current raised.

Add optional column `pledges.display_handle` (fallback to profiles.handle) so avatars/backer list render without extra join contortion. (Or just join `profiles` — decide: join `profiles`.)

Seed a couple of demo campaigns (one Janoshik, one Finnrick) with their tier rows.

## 2. Server functions (`src/lib/board.functions.ts`)
- Extend `getBoard` to also return per-item tiers and a backer list (handle + amount + created_at, top N).
- No changes to `createPledgeCheckout` — already manual-capture with metadata; already gated by state.
- Add validation: if `us_only`, require a checkbox confirmation flag in the checkout input (`us_shipping_ack: true`).

## 3. `/board` UI (`src/routes/board.index.tsx`)
Rebuild card rendering to include:

- **Header**: mission line + "Some batches fund in under 40 pledges."
- **Grid** of cards with three visual states driven by `state`:
  - `funding` / `nominated` → progress bar + tier ladder + pledge chips
  - `procuring` / `testing` → "Testing in progress" state, ladder frozen at reached tiers
  - `published` → results panel replaces ladder
- **Card contents**:
  - Peptide name, vendor, batch ID, thumbnail
  - Lab badge: "Janoshik · ships worldwide" or "Finnrick · US only"
  - Progress bar `$raised / $goal` + backer count
  - Tier ladder: each tier row with lock/unlock icon, name, cumulative threshold; animated unlock when `raised >= threshold`
  - Backer avatars strip (initials chips) + expandable full list with amounts
  - Trust note: sealed-vial statement
- **Results panel** (when published + result row exists): purity %, endotoxin EU/vial, heavy metals pass/fail, sterility pass/fail, COA link. Pull structured findings from `results` table — add optional JSON column `findings` if not present, otherwise parse `summary`.
- **Pledge flow**: modal with preset chips $5/$10/$25/$50 ($5 highlighted) + custom amount. For Finnrick cards, checkbox "I confirm the vial ships from within the US." Reuses existing `createPledgeCheckout` + embedded Stripe Checkout.
- **Disclaimer** under button and expandable **"How funding targets are set"** panel with Janoshik + Finnrick pricing reference text.

## 4. Aesthetic
Muted navy/ivory palette via existing tokens in `src/styles.css` (add `--ivory`, `--navy-deep`, `--navy-muted` if missing). Rounded cards, subtle shadow, generous spacing, framer-motion or CSS transitions on progress bar fill and tier unlock (green check swap-in).

## 5. Out of scope
- No changes to auth, webhook, or MCP.
- No new Stripe products.
- No admin UI changes beyond letting admin set `lab`, `us_only`, `thumbnail_url`, `coa_url` via existing `adminSetItem` (extend input schema).

## Technical notes
- `findings` JSONB column on `results` (nullable) so the published card can render structured metrics without regex on `summary`.
- Tier "unlocked" is derived client-side: `raised_cents >= tier.threshold_cents`. Persist tiers per item; do not hardcode in the component (spec says editable, but keeping in DB matches existing admin flow — the two seeded campaigns act as the reference).
- Backer avatars: initials from `profiles.handle`; if user opted anonymous, show "Backer".

## Deliverables
1. Migration: add columns + seed 2 demo campaigns with tiers.
2. `board.functions.ts`: extend `getBoard`, `adminSetItem`, `createPledgeCheckout` input.
3. `board.index.tsx`: full UI rebuild per spec.
4. Small components: `TierLadder`, `BackerStrip`, `ResultsPanel`, `HowFundingWorks`.
