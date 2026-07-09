
# "Test This Next" — Community Testing Board

Adds a public crowdfunded testing board to the existing Certificate Checker. Anyone can browse product nominations, pledge money toward independent testing, and read published results. Pledges are held on Stripe with all-or-nothing capture. Certificate-checker nominations flow into the board.

## What gets built

### New pages (public, shareable, own OG tags)
- `/board` — the board. Filter chips: Nominated · Funding · Funded · Procuring · Testing · Published · Expired. Item cards show product name, seller, state, funding bar, goal breakdown line, pledger count.
- `/board/$itemId` — item detail. State timeline, full goal breakdown (sample + test + operations margin), stretch tiers, pledger list (handles only), pledge form, discussion-free (comments out of scope).
- `/board/nominate` — nominate a product (name, seller, source URL, notes).
- `/registry/$itemId` — the published result page (permanent, shareable, plain-language report + fixed disclaimer). Appears only once state = Published.
- `/board/backer` — signed-in backers see their own pledges and status.
- Existing `/` (Certificate Checker) — unchanged, except its "Nominate for independent testing" button now creates a real board nomination (requires sign-in; unauthenticated users get a "Sign in to nominate" CTA).

Global nav gains three links: Checker · Board · Registry.

### Roles
- **Anyone (signed out):** browse board, browse registry, read published reports.
- **Backer (email + Google sign-in):** nominate, pledge, view own pledges.
- **Admin (manual role grant via `user_roles`):** move items between states, set goals & test batteries, sign off adverse results, mark procured / tested / published, upload the final report.

### Item states (fixed, exactly as spec)
Nominated → Funding → Funded → Procuring → Testing → Published, plus Expired / Refunded terminal state. Only admins transition; the app enforces legal transitions.

### Funding & payments
- Stripe (Lovable-managed seamless integration) — real payments. Full compliance handling not applicable to this offering (it's commissioning a service), so tax setup will be **tax calculation and collection only**.
- Pledges use Stripe **PaymentIntents with `capture_method: manual`** — authorization only, no charge. When the item reaches its goal, admin action captures all successful auths; when it expires or fails procurement, all auths are cancelled → automatic release. This is the correct primitive for all-or-nothing pledges on Stripe.
- Card auths only hold ~7 days. So Funding items have a max **14-day funding window** with a rolling re-auth reminder to backers if not yet funded; expired auths are auto-cancelled and the pledger re-authorizes.
- Backers see: "Your card is authorized, not charged. You are only charged if this test is fully funded."
- Surplus above goal flows to a visible community fund (single row we track and display on the board footer).

### Integrity rules (rendered in every item detail + registry page)
Fixed text block, always present:
1. The cooperative buys samples anonymously — pledgers and sellers never supply the vial.
2. Every funded test is published, whatever the outcome.
3. Results are tied to a specific batch and date.
4. Adverse results are signed off by a named human reviewer before publishing.
5. Funding a test never influences the result.

### Reused disclaimer
The existing checker disclaimer text appears on every registry page.

## Data model (Lovable Cloud)

```text
profiles            id (=auth.users.id), handle, created_at
user_roles          user_id, role ('admin')                              -- separate table, per rules
board_items        id, product_name, seller, source_url, sequence?, state,
                    goal_cents, sample_cost_cents, test_cost_cents,
                    operations_margin_cents, test_battery (jsonb),
                    funding_deadline, nominated_by, created_at, updated_at
board_stretch_goals item_id, label, add_cost_cents, unlocked
pledges             id, item_id, user_id, amount_cents,
                    stripe_payment_intent_id, status
                       ('authorized'|'captured'|'cancelled'|'failed'),
                    created_at
results             item_id, batch_id, sampled_at, tested_at, lab_name,
                    report_url (Storage), summary, verdict, signed_off_by,
                    published_at
community_fund      single row: total_cents (updated on capture)
```

RLS: everything scoped. Anyone can SELECT `board_items` and `results` where state indicates public visibility. Backers see their own `pledges`. Admins do everything through `has_role(auth.uid(), 'admin')`.

## Server surface

- `nominateItem` — create Nominated row.
- `createPledge` — create Stripe PaymentIntent (manual capture), return `client_secret`, store row as `authorized` on webhook confirmation.
- `getBoard` / `getItem` / `getRegistry` — public reads via publishable client + `TO anon` policies.
- `getMyPledges` — auth read.
- Admin: `setGoal`, `transitionState`, `captureAllPledges`, `cancelAllPledges`, `publishResult`, `signOffAdverseResult`.
- Webhook: `POST /api/public/webhooks/stripe` — verifies signature; updates pledge status on `payment_intent.amount_capturable_updated`, `.canceled`, `.succeeded`.

## AI (per spec: "AI agent runs the board")

Uses existing Lovable AI Gateway (Gemini). Server functions:
- `draftItemDescription({ productName, seller, notes })` — plain description for admin review.
- `suggestGoalBreakdown({ productName, testBattery })` — pulls from a small table of test costs seeded in migration.
- `draftResultReport({ result })` — plain-language report from raw lab values, routed for human sign-off before publish.

All AI outputs are drafts an admin approves; nothing publishes autonomously.

## Design

Keep the existing warm-ivory + serif-display palette. Board is a restrained card list, not a Kickstarter grid. Funding bars are thin taupe with a teal fill (`#0F7B6C`), never over-saturated. State badges use the existing pale-fill / dark-same-family-text badge system. Registry pages read like a published lab report.

Dark mode: the existing tokens carry through.

## Build order

1. Enable Lovable Cloud, add profiles + auth (email + Google), `user_roles`, `has_role`.
2. Run `recommend_payment_provider`, then enable seamless Stripe with tax calculation and collection only.
3. Migrations: all tables above + RLS + grants + seed 3 demo items (one Funding, one Funded, one Published with a signed-off result) so the board is never empty.
4. Board list + item detail (read-only public reads).
5. Nominate flow (signed-in). Wire the checker's nominate button to it.
6. Pledge flow with Stripe manual-capture PaymentIntents + webhook.
7. Admin console (single `/admin` route under `_authenticated`, gated by `has_role`) for state transitions, goal editing, capture/cancel, publish.
8. Registry page + AI report drafting.
9. Community fund totals + honest framing block sitewide.

## Explicitly out of scope

Comments/discussion, on-chain escrow (spec calls it optional, later), refunds outside auto-cancel, email notifications beyond Supabase auth mail, and mobile app.
