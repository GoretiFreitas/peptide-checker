# Accept crypto (USDC) through Stripe Checkout

Contributions already run through Stripe Checkout Sessions. Neither the `/support` checkout nor the `/fund` pledge checkout sets `payment_method_types`, so once "Stablecoins and Crypto" is enabled on the Stripe account, crypto is offered automatically by dynamic payment methods. Both flows already charge in `usd` (fund pledges use `price_data` with `currency: "usd"`; support uses the existing USD price catalog). So the work is recording, surfacing, and documenting it.

Note: the Stripe account itself must have "Stablecoins and Crypto" turned on in the Stripe dashboard — that toggle is not something the app code can set.

## What changes

1. **Copy on the pages** — add a small line "Card and crypto (USDC) accepted." next to the payment options on `/support` (near the plan/donation buttons) and on `/fund` campaign pages and the fund index card actions.

2. **Record the payment method** — store which method was used for each contribution:
   - New nullable `payment_method_type` text column on `pledges` and on `purchases`.
   - The payments webhook reads the charge's payment method type (e.g. `card`, `crypto`) from the expanded payment intent and writes it on the row it upserts.
   - The manual post-payment confirmation path (`confirmPledgeSession`) fills the same field so pledges confirmed via the return URL aren't left blank.

3. **Admin audit trail** — add a "Method" column to the admin transactions table and to the CSV export, showing card / crypto / other, falling back to "—" for older rows.

4. **Internal note** — a short crypto-payments section in the project README plus a one-paragraph help note on the admin page: crypto payers are sent to crypto.stripe.com to connect a wallet, and refunds settle back to a wallet and may arrive on a different token contract than the one used to pay, linking Stripe's refund docs.

Nothing else changes: no wallet-connect UI, no separate crypto checkout path, no payout or accounting changes (crypto settles into the Stripe balance in USD).

## Technical detail

- Migration: `alter table public.pledges add column payment_method_type text;` and same on `public.purchases`. No policy changes needed — both tables already restrict client writes.
- `src/routes/api/public/payments/webhook.ts`: the session retrieve already expands `payment_intent.latest_charge.balance_transaction`; read `charge.payment_method_details.type` and include it in both the `purchases` upsert and the pledge update in the fund branch.
- `src/lib/board.functions.ts`: `confirmPledgeSession` sets `payment_method_type` when marking the pledge paid; `getAdminMetrics` selects the new column so the admin table can render it.
- `src/routes/admin.tsx`: new column header/cell and an extra CSV field.
- `src/routes/support.tsx`, `src/routes/fund.index.tsx`, `src/routes/fund.$itemId.tsx`: the accepted-methods line, using existing muted-text styling.
