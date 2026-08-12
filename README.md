# PeptidesCheck

Independent, community-funded peptide certificate verification and lab testing.

## Payments

Contributions on `/support` and `/fund` run through Stripe Checkout Sessions
(embedded mode). We never set `payment_method_types` on a session, so Stripe's
dynamic payment methods decide what to offer. All line items are priced in
`usd`.

### Crypto / stablecoin (USDC)

Crypto is enabled purely by turning on **Stablecoins and Crypto** in the Stripe
dashboard for the account — there is no app-side wallet integration, no custom
payment-intent logic, and no separate crypto checkout path.

Operational notes:

- A customer paying with crypto is redirected to `crypto.stripe.com` to connect
  a wallet, then returns to the normal Checkout return URL.
- Funds settle into the Stripe balance in **USD**, so payouts, accounting, and
  the community-fund split are unchanged.
- **Refunds** on a crypto payment settle back to a wallet, and the refund can
  arrive on a **different token contract** than the one used to pay. See
  <https://docs.stripe.com/crypto/stablecoin-payments/refunds>.
- Every contribution stores `payment_method_type` (`card`, `crypto`, …) on the
  `pledges` / `purchases` row; the admin transactions table and CSV export
  surface it as a "Method" column.
