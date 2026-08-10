# Post-contribution engagement flow for /fund

Adds a proper success step, a share page, and public backer lists — using the site's current funding model (charged immediately; if a batch misses its goal the contribution rolls over to the most-backed active campaign). Handle editing is for signed-in backers; the Instagram card is generated in the browser.

## 1. Contribution success step

Replaces the small green banner on `/fund/<id>` after payment with a dedicated success panel showing:

- Campaign name + batch identifier
- Amount contributed
- Progress: raised of goal, backer count
- What happens next: the batch goes to an independent lab and results are published to every backer; if the goal isn't met the contribution rolls over to the most-backed active campaign
- Membership confirmation (unchanged behaviour)
- Primary CTA: "Help this batch get tested — share" → share page
- Secondary: "Back to campaigns"

Directly below, an optional identity block (never on the payment form):

- "X handle (optional — shown on this campaign's backer list)"
- Visibility: Show my handle / Show initials only / Anonymous — **default: initials only**
- Checkbox: hide my amount on the backer list
- Handle rules: strip a leading `@`, 1–15 chars, letters/numbers/underscore only. Self-reported, never shown with a verification badge.
- Editable later from the same campaign page (and from the contributions list) while signed in.

## 2. Share page — `/fund/<id>/share`

Public, no login needed. Pre-filled and editable text for each channel:

- **X**: "I just backed independent lab testing of [Peptide, Batch ID] on @desciers' PeptidesCheck. $X of $Y funded — one test, results shared with everyone: [URL]" → opens the X intent
- **Reddit**: subreddit picker (default suggestion r/DecentralizedSciences) plus prefilled title and body → opens the Reddit submit intent
- **Instagram**: no web intent — a downloadable PNG share card (peptide name, batch ID, progress bar, PeptidesCheck branding, research-use disclaimer) plus "Copy caption"
- **Copy link** fallback

All default copy is research-use framed: no claim of safety, efficacy, purity outcome, or human use. The disclaimer line is baked into the card image and appended to the caption.

## 3. Backer list per campaign

A "Backers" section on each campaign page, visible without login:

- Display identity per the backer's own choice: handle (clickable link to x.com/handle), initials with a generated avatar, or "Anonymous"
- Amount, unless hidden by that backer
- Date
- Anonymous contributions still count in the backer total and raised amount
- Amounts reflect the charged state of each contribution

## 4. Constraints honoured

Mobile-first layout, no third-party tracking scripts (share links are plain outbound URLs, the card is drawn locally), share page and backer list are public.

---

## Technical notes

**Database migration** on `pledges`: `x_handle text`, `display_mode text default 'initials'` (`handle` | `initials` | `anonymous`), `hide_amount boolean default false`. Validation of handle format enforced both client-side and in the server function.

**Server functions** (`src/lib/board.functions.ts`):
- `getCampaignBackers` — public (publishable-key client via an anon-readable projection or admin client returning only display-safe fields): display name, avatar seed, amount-or-null, date, handle-or-null. Never returns user ids or emails.
- `updatePledgeIdentity` — `requireSupabaseAuth`, scoped to the caller's own pledge; validates and normalises the handle.
- `getItem` extended to return batch id and the backer list for the campaign page.

**Routes**: new `src/routes/fund.$itemId.share.tsx` (public, SSR, own `head()` with title/description/og tags). Success panel and identity form become components under `src/components/fund/`.

**Share card**: `<canvas>` drawn client-side at 1080×1350, exported via `toBlob` and downloaded; no server image endpoint.
