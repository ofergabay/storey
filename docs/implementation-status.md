# Storey implementation status

Updated: 24 November 2026, after reconciling the uncommitted weekly payout, PayMe sandbox, and experiment files with the role, RLS, and masking rules.

## Reconciliation

The weekly payout, PayMe sandbox, and three experiments stay in this working tree. They are not a live charge, a live withdrawal, or a change to storey-dev. Role separation, the tenant RLS file, and buyer phone/street masking stay as they were.

- **Weekly payout** stays on `weekly-2026-11` for an enabled seller cohort. A batch includes only captured orders that are not a creator preview, not failed or cancelled, and not fully refunded or in an open dispute. The admin who creates the instruction is stored as the maker and written to the audit log. That same person cannot mark it `bank_paid`. The finance button still only simulates completion, and simulation does not set a bank reference. `withdraw-balance` is not called.
- **PayMe sandbox** still requires `PAYME_ENV=sandbox` and `https://sandbox.payme.io/api/`. Amounts are positive integer agorot in `ILS`. A hosted sale moves from pending (`held`) to paid (`sandbox_paid`), failed (`failed`), or cancelled (`cancelled`). A failed or cancelled callback does not capture and does not post a journal. A repeated callback does not post again. Buyer listing and checkout pages show the retail price and the buyer shipping price. Wholesale stays in the quote calculation.
- **Experiments** stay behind `STOREY_EXPERIMENT_FIRST_SHARE`, `STOREY_EXPERIMENT_PARTY_KIT`, and `STOREY_EXPERIMENT_MY_PACE`. Unset is on only in development. Production and every other environment stay on the current screen unless the flag is `on`. A creator, supplier, or admin opening a public listing is a preview: it is not a visit and it is not a pace sale. The visit rows are not the seller analytics report in FR-WEB-006.

## Creator experiments

Three experiments sit on the existing catalog, listing, checkout, and earnings screens. Each has its own flag and a stable assignment stored in gitignored `data/dev-experiments.json`. In development an unset flag is on and splits 50/50. In production, test, and every other environment an unset flag is off. Setting a flag to `off` keeps the current screen. Setting it to `on` enables that one experiment.

- `STOREY_EXPERIMENT_FIRST_SHARE` is assigned by creator. The product page still autosaves the price and shows expected earnings from the existing split. A treatment creator gets one saved line, an angle, and separate actions for WhatsApp, Instagram, Facebook, X, and copy. The Story image does not contain the link. Manual edits stay until “תנו לי אחרת”. Generated lines are checked against other creators for the same product and language.
- `STOREY_EXPERIMENT_PARTY_KIT` is assigned by the `storey_vid` visitor cookie. The listing shows the pack quantity and price, then a city and postcode lookup that uses the published supplier tariff. A missing or changed quote is stated before the checkout link. Checkout still rechecks stock and shipping, and stores creator, offer, campaign, and channel on the order.
- `STOREY_EXPERIMENT_MY_PACE` is assigned when a creator has a first delivered order. The earnings page shows that order once, the ledger amount, and a duplicate-campaign draft. “הקצב שלי” uses trailing days in Asia/Jerusalem, keeps a refunded delivery in the count, and does not turn a loss into a larger projection.

A creator preview and the common social preview crawlers are not recorded as qualified visits. Opening a composer, saving the Story image, or copying a link is the share action. Publication stays with the creator.

These channel composers were not opened on a real device: WhatsApp, Instagram’s native share sheet, Facebook, and X. The tests check the destination URLs, the X length rule, the Story file, the clipboard message, and the fallback.

## PayMe sandbox

The hosted checkout adapter talks only to `https://sandbox.payme.io/api/`. Storey never collects a card number. The in-process simulator remains the regression path and the path for payout steps PayMe has not approved. `lib/commerce/payment/port.ts` is the adapter boundary. The test adapter stays `live: false`. A PayMe case is stored with `adapter: "payme"` and `live: false`.

Set these on the server, not in the client bundle:

- `PAYME_ENV=sandbox`
- `PAYME_API_BASE=https://sandbox.payme.io/api/`
- `PAYME_CLIENT_KEY`
- `PAYME_CLIENT_PASSWORD`
- `PAYME_CALLBACK_URL` as a public `https` URL. `localhost` is rejected.
- `PAYME_RETURN_ORIGIN` as a public `https` origin. The buyer returns to `/payme/return/[token]`, which only redirects to tracking.
- `data/dev-payme-sellers.json`, gitignored, mapping a creator handle to `seller_payme_id`.

`STOREY_PAYME_PAYOUTS` stays unset. `withdraw-balance` is not called. A prepared withdrawal uses the batch total in agorot, not a larger wallet balance. A balance transfer and a bank withdrawal are different records. Simulated completion of a weekly instruction does not set `bank_paid`.

`generate-sale` uses `sale_type=authorize`, integer agorot, `ILS`, the Storey order id, and `market_fee: 0`. Neither commission rate is sent as `market_fee`. The returned `payme_sale_id` is stored before the hosted page is shown. A refresh resumes that sale. Partner callbacks are checked with `md5(client_key + client_password + payme_transaction_id + payme_sale_id)` and then re-read with `get-transactions`. A bad signature changes nothing. After a verified authorization, an expired hold is voided with `refund-sale` and is not captured. A verified capture posts one journal and releases fulfillment once. A lost capture stays on the same sale. A partial refund uses `sale_refund_amount`. A repeated callback does not add credit. A provider status of failed, declined, or rejected moves the order to `failed` and releases the hold. A void or cancellation moves it to `cancelled`. Neither status captures or posts a journal. A second callback for that sale does not release the hold again or open another sale.

Routes: `POST /payme/callback`, `GET /payme/return/[token]`. The Party Concept tracking page keeps `רכישת ארגז פיתוח` for the simulator and shows the PayMe button only when the creator mapping and public URLs exist. A missing mapping is a configuration error and does not open a sale.

`supabase/migrations/20261123200000_payme_callback.sql` was applied only to an isolated PGlite database in `tests/payme-contract.test.ts`. It was not applied to storey-dev.

Three labels:

- **Simulated.** The local adapter, the weekly statement, and `סיום מדומה של ההוראה`. This is not a provider payment.
- **PayMe sandbox confirmed.** Not yet. The external hosted charge and refund were not run.
- **Waiting on provider approval.** The approved source account, two-beneficiary routing, a withdrawal before delivery, and the reversal process. Live payouts stay off.

The external sandbox run is **unverified**. It needs a sandbox partner key, the client password, the creator `seller_payme_id`, a public callback URL, and a connected sandbox terminal. Production credentials, live withdrawals, storey-dev SQL, and deployment stay off.

## Weekly policy

`weekly-2026-11` is the policy for a new quote when the seller is in the enabled cohort. `STOREY_PAYMENT_POLICY=pay-2026-11` or `STOREY_PAYMENT_POLICY=weekly-2026-11`, together with `STOREY_PAYMENT_COHORT`, is only that switch. In development, `data/dev-payment-cohort.json` can enable the same pair. It is gitignored. Production ignores that file. The local cohort file is paused.

A quote already stored as `original-2026-11` or `pay-2026-11` keeps that snapshot. The original 70 / 35 / 5 capture and the unpaid Party Concept ₪50 order are unchanged. `pay-2026-11` still waits seven days after delivery. `weekly-2026-11` makes a unit eligible when delivery or pickup is verified. A label or dispatch does not.

Storey commissions are integer basis points, 0–100%, with an effective date and an audit row. Only an admin can publish them. Supplier and creator rates are independent. 5% and 10% appear only in the test fixture. The rates live in gitignored `data/dev-commissions.json`, not in source.

A supplier publishes, previews and retires tariffs for warehouse `PILOT-01` from `/supplier/settings`. Coverage prefers postcode, then city, then zone, then nationwide. Two prices at the same priority are rejected. The buyer sees each shipment group before payment on the social listing checkout. Pickup is not selected by default. A group with no service blocks payment. Buyer-paid shipping, the supplier freight entitlement and the sponsor are stored separately. Supplier-funded free shipping charges the buyer zero and leaves the supplier with no freight entitlement. Creator-funded free shipping charges the buyer zero, keeps the supplier freight, and reduces the creator proceeds. A negative creator result blocks the quote.

Capture uses the accepted snapshot. Changing a tariff or a commission afterwards does not change that capture or its refund. Shared freight is split by largest remainder. A later parcel split does not change the buyer charge, and released freight cannot exceed the snapshot. The weekly batch pays one beneficiary across orders and creators. The cutoff is Sunday 00:00 Asia/Jerusalem unless `STOREY_WEEKLY_WEEKDAY` and `STOREY_WEEKLY_HOUR` override it. The payout instruction reference and the bank reference are different. The adapter remains simulated. No live charge, refund or bank payout is sent.

`supabase/migrations/20261123180000_weekly_payout.sql` was applied only to an isolated PGlite database in `tests/weekly-policy.test.ts`, together with the earlier payment migration. It was not applied to storey-dev.

The zero-tax fixture is retail ₪100, wholesale ₪60, supplier delivery ₪25, supplier commission 5% and creator commission 10%. The buyer pays ₪125 once. Supplier entitlement is ₪82, creator entitlement is ₪36, and Storey gross commission is ₪7. Processing is recorded separately. Before delivery both beneficiaries are eligible for ₪0. After one verified delivery they are eligible for ₪82 and ₪36. A repeated delivery event does not change either balance.

## Payment policy

The new card, refund and payout policy is `pay-2026-11`. Existing quotes, the Cloud Nine price, the original Party Concept order `ord-1795387712355`, and the original 70 / 35 / 5 capture stay on `original-2026-11`. A missing policy version means original. The example 5% supplier and 10% creator rates are test configuration, not an approved rate card.

`STOREY_PAYMENT_POLICY=pay-2026-11` is only the master switch. It does not enroll every seller. `STOREY_PAYMENT_COHORT` is a comma-separated list of seller handles. A new quote uses `pay-2026-11` only when the switch is on and the seller is in that list. In development, `data/dev-payment-cohort.json` can supply the same pair without restarting the server. It is gitignored. Production ignores that file.

Turning the switch or the file off changes only quotes created after that. An order already stamped `pay-2026-11` keeps that snapshot for capture, refund, and payout. The browser showed this: creator was enrolled and order `ord-1795411096466` stored `pay-2026-11`; the cohort was then limited to `maya`, and the next creator quote `ord-1795411343385` stored `original-2026-11` while the earlier order stayed on the new policy.

The money path is the in-process test adapter. It does not call a provider and it cannot create a live charge, refund, or bank payout. `supabase/migrations/20261123010000_payment_policy.sql` was applied only to an isolated PGlite database in `tests/payment-db.test.ts`. It was not applied to storey-dev. It does not change checkout, publish, or `inventory_pools`.

| Requirement | Layer | Result |
|---|---|---|
| PAY-01 to PAY-05, PAY-08, PAY-10 to PAY-14 | Reducer | Passed in `tests/payment-workflow.test.ts`. |
| PAY-06 | Browser and adapter | Pick, pack, label, and dispatch ran on the new order. The label, manifest, and courier amount are local notes. Buying a label, carrier acceptance, and a courier invoice remain external. |
| PAY-07 | Reducer and warehouse screen | Accept, reject, and timeout are in the reducer. The warehouse queue can offer a dated backorder, the buyer can accept or reject it, and the warehouse can time it out. |
| PAY-09 | Browser | The new-policy order was not dispatched before its captured test journal. Dispatch then decremented the development count once. |
| PAY-13 | Reducer and returns screen | Inspection records the unit, `sellable` / `quarantine` / `loss`, and the supplier source. Quarantine and loss do not restore development stock. The original Party Concept return has no payment case and was not changed. |
| QA-01 to QA-15 | Reducer | Passed, including the original 70 / 35 / 5 capture. |
| QA-02 | Database and browser | Persisted rows and Finance both show capture ₪141, refund ₪82, supplier A ₪22.80, creator ₪31.50, Storey net ₪1.70, processing ₪3. Only `a#1` has a payout clock. |
| Cohort | Same process | Creator enrolled and Maya excluded, then the switch paused. Stored policies did not change. |
| Concurrency | Two database connections | See the table below. |

| Concurrency check | Invariant | Persisted result |
|---|---|---|
| 100 buyers, one unit | At most one hold | 1 success. `free_qty` 0. `committed_qty` 1. |
| Two payout workers | The second waits on the open transaction | The second call stayed blocked for 250ms, then returned `replay`. One claim row for ₪31.50. |
| Stop and handoff | One stage per unit | Both connections returned the same persisted stage, either `canceled` or `handed`. |
| Refund and payout | They do not both spend the entitlement | One refund of ₪59. The payable refund plus the claim is at most ₪59. |
| Crash after provider capture | Restart recovers the original reference | Before recovery, zero journal rows. After recovery, one balanced journal, one `fo-release`, and a second recovery returns `replay`. |

Enable a pilot only after Finance approves the rates and the freight, fee, tax, and dispute rules, and after Payments confirms the provider in writing:

1. Compare the test adapter with the original calculator on shadow quotes. Do not post those results.
2. Set `STOREY_PAYMENT_POLICY=pay-2026-11` and `STOREY_PAYMENT_COHORT` to the approved seller handles. New quotes for those sellers snapshot the new policy. Other sellers, and older quotes, do not change.
3. Pause by removing the policy variable or clearing the cohort. New quotes return to the original policy. In-flight `pay-2026-11` orders continue on their stored snapshot.
4. Keep live charges, refunds, bank payouts, storey-dev, and production deploy off until those approvals exist.

## Browser and restart check

These amounts were read from the browser. The database race results above stay in `tests/payment-db.test.ts` and were not repeated in the browser.

| Step | Expected | Observed |
|---|---|---|
| Published Party Concept page | ₪50, draft ₪70 hidden | http://localhost:3000/s/creator/party-01 showed ₪50. The draft was not on the page. |
| Eligible quote | `pay-2026-11` for `creator` | Checkout said the new quote uses `pay-2026-11`. Order `ord-1795412721125`, token `tok-1795412721125`, charge ₪50. |
| Ineligible quote, same server | `original-2026-11` | `/s/outsider/party-01/checkout` said `original-2026-11`. Order `ord-1795412739579` stored that policy. |
| Crash before confirmation | Provider accepted, Storey journal empty | Provider ref `test-ord-1795412721125` was captured for ₪50. The case status was `capture_unknown` and its journal was empty. The dev server then exited. |
| Restart and reopen tracking | One capture, one balanced journal, one release, no second payment | After restart, the same tracking URL showed ₪50, ref `test-ord-1795412721125`, one capture journal, one fulfillment release, and no purchase button. Persisted debit and credit were both 5000. A second open did not add a journal. |
| Same order on the other screens | Same id and ₪50 charge | Earnings: economic ₪16.20 pending. Settlements: `PILOT-01` ₪30.40 pending. Finance: charge ₪50, refund ₪0, policy `pay-2026-11`, journal balanced, no clock yet. |
| Earlier unpaid order | ₪0 | `ord-1795387712355` stayed dispatched with its reconciled return. Earnings, settlements, and Finance each showed ₪0 for that order. |
| Pause, then finish and refund | Stored policy, one ₪50 refund | The cohort file was turned off. Warehouse pick, pack, label, and dispatch produced `SBX-ord-1795412721125`. Simulated delivery, return, and sellable inspection refunded ₪50 once. Tracking still said `pay-2026-11` while the banner said new quotes are paused. |
| Quote after the pause | `original-2026-11` | The next creator checkout stored `ord-1795413112045` as `original-2026-11`. |
| Two-supplier fixture | One ₪82 refund and the ₪59 split | Finance ran the fixture. It showed charge ₪141, one refund ₪82, supplier A ₪22.80, creator ₪31.50, Storey net ₪1.70, processing ₪3, and a clock only on `a#1`. The replay line said the repeated cancellation did not add a refund. |

The local crash drill is `data/dev-payment-crash.json` with `beforeConfirm: true`. It is gitignored. The simulator writes the provider reference first. In development the process then stops before the confirmation journal. The next process start, and opening the same tracking page, recovers that reference. The file is now `{ "beforeConfirm": false }`. The cohort file is paused.

The courier-paid-directly branch is not enabled. Tax is accepted only when the quote says tax was determined. QA-04 uses the explicit per-line tax in the fixture. No commercial tax rate was invented. A real payment provider, bank payout, carrier label purchase, carrier manifest acceptance, and a courier invoice are still external.

## How to open a role

Development only. Open http://localhost:3000/dev and choose אורח, יוצר/ת, ספק, or ניהול. The choice is an httpOnly cookie for eight hours and it overrides a Supabase session while `NODE_ENV` is development. It is not a production login. There is no warehouse role. An admin can open a supplier or creator screen only with `?inspect=1`, and that view cannot submit fulfillment. `proxy.ts` sends a signed-in user away from `/`, `/login`, `/register`, and `/plans` before those pages render. An admin can still open `/?preview=1`. `/register/supplier` stays available.

The confirmed Supabase admin remains `ofergabay@gmail.com`. Sign in at `/login` with that account’s existing password. `STOREY_ADMIN_EMAILS` can add more admin emails. Supabase requires email confirmation before a new registration gets a session. A reserved address such as `admin@storey.test` is rejected by Auth. Password recovery renders at `/recover` and was not submitted, so no reset email was sent.

## Pages

| Page | URL | Who | How they arrive | Primary action | FRD | Verification |
|---|---|---|---|---|---|---|
| Homepage | http://localhost:3000/ | Everyone | Direct | הרשמה כיוצר/ת, הצטרפות כספק, כניסה | FR-WEB | Browser, 360 px and desktop |
| Registration | http://localhost:3000/register | Guest | Homepage | Create account; email confirmation required | FR-SUB-001 | Browser form. No new confirmed account |
| Supplier application | http://localhost:3000/register/supplier | Guest | Homepage | Submit a pending supplier application | FR-SUB-002 | Browser form. Not submitted |
| Login | http://localhost:3000/login | Guest | Homepage | Sign in | FR-SUB-001 | Browser. Direct role URLs redirect here |
| Recovery | http://localhost:3000/recover | Guest | Login | Ask for a reset link without revealing the account | FR-SUB-001 | Browser form. Email not sent |
| Email verification | http://localhost:3000/verify | Guest | After signup | Explain that login waits for the email | FR-SUB-001 | Browser |
| Plans | http://localhost:3000/plans | Everyone | Homepage | Compare Social, Branded, Scale | FR-SUB-003 | Browser. Only Social is 0 ₪ |
| Onboarding | http://localhost:3000/onboarding | Signed in | Account | Show missing fields and application status | FR-SUB-001 | Browser empty state |
| Development roles | http://localhost:3000/dev | Development | Nav | Switch the local role | Local only | Browser |
| Studio | http://localhost:3000/studio | Creator, admin | After the creator role | Open product selection | FR-WEB | Browser. Development role shows the studio home. Maya still needs the linked account |
| Catalog | http://localhost:3000/catalog | Creator, admin | Studio or nav | Search and בחירת מוצר | FR-CAT | Browser. Guest redirects to login |
| Price editor | http://localhost:3000/catalog/PARTY-01 | Creator | בחירת מוצר | Save a draft or publish | FR-FIN-001 | Browser. Draft ₪70 stayed private; published price is ₪50 |
| My listings | http://localhost:3000/listings | Creator | Nav | See draft versus published and share | FR-WEB-001 | Browser |
| Campaigns | http://localhost:3000/campaigns | Creator | Nav | Request a reserve; Social plan refuses it | FR-INV-004 | Browser. Stock stayed unchanged |
| Storefront editor | http://localhost:3000/storefront | Creator | Nav | Save a collection and return policy | FR-WEB | Browser. Custom domain is not verified |
| Public store | http://localhost:3000/s/creator | Everyone | Saved storefront | Browse published prices | FR-WEB | Browser. Shows ₪50 and the saved policy |
| Orders | http://localhost:3000/orders | Creator | Nav | Open tracking | FR-ORD | Browser. Status נשלח |
| Earnings | http://localhost:3000/earnings | Creator | Nav | Show profit and block payout | FR-FIN-008 | Browser. ₪0 after the reconciled return |
| Account | http://localhost:3000/account | Signed in | Nav | Show plan, team, and blocked billing | FR-SUB | Browser. Billing is inactive |
| Cart | http://localhost:3000/cart | Everyone | הוספה לעגלה | Keep a line without reserving stock | FR-INV-006 | Browser. Held stayed 0 |
| Shared listing | http://localhost:3000/s/creator/party-01 | Everyone | Published link | Show only the published price | FR-WEB-001 | Browser. ₪50, no cost, no draft |
| Cloud Nine | http://localhost:3000/s/maya/cloud-nine | Everyone | Homepage | Existing published listing | FR-WEB | Browser. Still ₪60 |
| Listing checkout | http://localhost:3000/s/creator/party-01/checkout | Everyone | להצעת מחיר | התחלת קופה creates a 10-minute hold | FR-INV-006 | Browser. Held went from 0 to 1 |
| Tracking | http://localhost:3000/track/tok-1795387712355 | Token holder | After checkout | Sandbox purchase, tracking, return request | FR-ORD | Browser. Tracking `SBX-ord-1795387712355` |
| Admin import and stock | http://localhost:3000/admin | Admin | ניהול role | Stage a product CSV or apply a stock CSV | FR-CAT-001, FR-INV-003 | Browser. The two actions stay separate |
| Staging | http://localhost:3000/admin/staging | Admin | After import | Approve or ignore a row | FR-CAT-001 | Browser. PARTY-01 approved |
| Product editor | http://localhost:3000/admin/products/PARTY-01 | Admin | Staging or catalog | Save Hebrew, English, and image rights | FR-CAT-003 | Browser. Rights saved as reviewed |
| Approvals | http://localhost:3000/admin/approvals | Admin | Nav | Approve a complete application | FR-SUB-002 | Browser empty state |
| Published catalog | http://localhost:3000/admin/catalog | Admin | Nav | Open a product and its edit history | FR-CAT | Browser. PARTY-01 rights show as reviewed |
| Admin orders | http://localhost:3000/admin/orders | Admin | Nav | See exceptions and returns | FR-ORD | Browser. The return shows הותאמה |
| Finance | http://localhost:3000/admin/finance | Admin | Nav | Reconcile sandbox totals without a payout | FR-FIN-010 | Browser. ₪0 and no PSP |
| Admin plans | http://localhost:3000/admin/plans | Admin | Nav | Show unpriced plans and publish commission rates | FR-SUB, FR-FIN | Browser. No signed contract. Commission publish is admin-only |
| Audit | http://localhost:3000/admin/audit | Admin | Nav | Read recorded actions | FR-IAM | Browser. Shows the approval, sandbox purchase, and edit |
| Warehouse queue | http://localhost:3000/supplier | Supplier, warehouse, admin | Role home | Pick, pack, label, dispatch | FR-IAM-003 | Browser as מחסן. Creator saw אין הרשאה |
| Supplier offers | http://localhost:3000/supplier/catalog | Supplier, admin | Nav | Read approved offers | FR-CAT | Browser |
| Stock counts | http://localhost:3000/supplier/stock | Supplier, warehouse, admin | Nav | Read counts, holds, and gaps | FR-INV-003 | Browser. PARTY-01 returned to 6 on hand and 0 held |
| Returns | http://localhost:3000/supplier/returns | Supplier, warehouse, admin | Nav | Receive and reconcile once | FR-ORD | Browser. Stock returned to 6 |
| Settlements | http://localhost:3000/supplier/settlements | Supplier, admin | Nav | Show supplier cost without paying it | FR-FIN-008 | Browser. ₪0 and not paid |
| Warehouse settings | http://localhost:3000/supplier/settings | Supplier, warehouse, admin | Nav | Show PILOT-01 and publish delivery tariffs | FR-IAM-003 | Browser. No carrier connection. A supplier publishes its own tariffs |

Sample files: http://localhost:3000/samples/products.csv, http://localhost:3000/samples/stock.csv, http://localhost:3000/samples/party-products.csv, and http://localhost:3000/samples/party-stock.csv. The Party files are the journey fixture. LILAC-24 remains a separate development fixture.

## Journey that passed in the browser

An admin staged קונספט למסיבה, approved it, and applied its development count of 6 at PILOT-01. A creator found it, saved ₪40 as a draft while the public link stayed inactive, published ₪50, then saved a later draft of ₪70. The public page stayed at ₪50 and did not show the cost. Adding it to the cart left held at 0. התחלת קופה raised held to 1. רכישת ארגז פיתוח did not charge a card. The warehouse role picked, packed, labeled, and dispatched it. On-hand went from 6 to 5 and the customer page showed `SBX-ord-1795387712355`. A return was requested, received, and reconciled once. On-hand returned to 6, held stayed 0, and earnings became ₪0.

Cloud Nine stayed on its own route at ₪60. Its checkout still depends on `begin_cloud_nine_checkout`, which is not installed on storey-dev.

Guest requests to `/admin`, `/catalog`, and `/supplier` redirected to login. A creator opening `/supplier` saw אין הרשאה. The homepage and the published listing were opened at 360 px and at a 1280 px desktop width.

## Checks

| Check | Where | Result |
|---|---|---|
| `npm.cmd test` | Node plus local PGlite, 23 November | 88 tests passed. Includes the experiment pace fixture, punchline claims, PayMe contract tests, the weekly ₪125 fixture, the weekly payout race, the earlier payment races, and the original 70 / 35 / 5 capture. |
| Focused tests, 24 November | `tests/experiments.test.ts`, `tests/weekly-policy.test.ts`, `tests/payme-contract.test.ts` | 35 passed, 0 failed. The full suite was not repeated. |
| `npm.cmd run lint` | ESLint, 24 November | No findings. |
| `tsc --noEmit` | App sources, 24 November. Tests stay on the Node runner | Passed. |
| `npm.cmd run build` | Next.js production, 24 November | Passed. The root layout sets `instant = false` so the locale cookie can set `lang` and `dir`. |
| Browser | localhost, development role cookie | The Party Concept journey above. |
| storey-dev | Not changed this session | `begin_cloud_nine_checkout` and `seller_plan_status` are still not installed. |

The development JSON files are not a warehouse attestation and not a payment. LILAC-24 was already in the development catalog before this journey. Live charges, real payouts, and production deployment were not run.

Status words mean different things:

- **implemented** — behavior exists in this repository.
- **verified** — a check named below was actually run.
- **blocked** — a named operation cannot go further until the dependency listed here exists.

A sandbox module is not a live charge, a live payout, or an attested warehouse count.

## Earlier database checks

These checks are unchanged. The current suite count is in the checks table above.

| Check | Where it ran | Result |
|---|---|---|
| Local SQL and plan tests | Node, in memory, plus one local PGlite database | The two-client hold and the zero-price plan test passed. The SQL file is `tests/inventory-sql.test.ts`. |
| Two `pg` clients competing for one pack | Local PGlite on `127.0.0.1:55432`. Not storey-dev. PGlite runs one query at a time, so the two calls did not overlap inside the function. | One `begin_cloud_nine_checkout` succeeded, the other raised `stock changed`. A retry returned the same `hold_expires_at`. `release_expired_checkout_holds` returned 1, then 0, and the free pool went from 0 back to 1. A later begin on the released quote raised `hold ended` and left the pool at 1. |
| Entitled and unentitled publish | Same local PGlite database, after `20261122240000_seller_plan.sql` | `publish_listing(6500)` returned 6500. After the subscription row was deleted, `publish_listing(6600)` raised `plan required` and the published price stayed 6500. |
| Signed-out customer page | `http://localhost:3000/s/maya/cloud-nine` in the browser | Visible price is ₪60. The page text does not include wholesale, earnings, the test phone, or the test street. A `69` in the HTML is an SVG path coordinate. |
| Quote form | `/s/maya/cloud-nine/checkout` | The submit button is `שמירת הצעת המחיר`. The note says saving the quote does not reserve stock. |
| Checkout button | Existing quote `f4bc845e-54e2-4c47-8cba-5337d13f16a4` | The buyer button is `התחלת קופה`. Clicking it called `beginCloudNineCheckout` and showed `שמירת המלאי עדיין לא מותקנת במסד`. The app does not call `create_cloud_nine_quote_with_hold`. |
| Seller studio in this browser | `/` | Signed out. The entitled-seller click was not repeated here. |

## Hold actor

Cloud Nine hold starts only in `beginCloudNineCheckout`. A development-catalog hold starts only in `beginListingCheckout`, from the `התחלת קופה` button on that listing’s checkout page. Saving a quote, saving a draft, publishing a price, opening a shared link, and adding a line to the cart do not reserve stock.

storey-dev still has `create_cloud_nine_quote_with_hold` until the forward migration below is applied. A direct call to that old function can still hold stock. The app no longer makes that call.

## Database

storey-dev already has `inventory_pools` and `checkout_holds`. `create_cloud_nine_quote_with_hold` is live there. A probe with quantity 0 raised `stock changed` and rolled back; it did not create a quote. `begin_cloud_nine_checkout` and `seller_plan_status` are not installed. This session had no database password, so those two files were not applied to storey-dev.

`20261122230000_inventory_holds.sql` was edited after that discovery. The edit removes the pool inserts from the file so a later replay cannot add stock. It was not executed again. Existing pool rows were not updated.

Run these two files in the Supabase SQL editor, in order. Do not re-run `20261122230000_inventory_holds.sql`. Do not run `supabase/seed/dev_pilot_stock.sql` on storey-dev; that seed is for a new database whose pool rows are absent, and it only inserts when the row is missing.

1. `supabase/migrations/20261122230100_begin_checkout.sql`
2. `supabase/migrations/20261122240000_seller_plan.sql`

Read-only check before and after. The migration does not change quantities; the two numbers should match.

```sql
select warehouse_code, bucket, quantity
from public.inventory_pools
order by warehouse_code, bucket;

select p.proname
from pg_proc as p
join pg_namespace as n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'begin_cloud_nine_checkout',
    'create_cloud_nine_quote_with_hold',
    'seller_plan_status'
  )
order by p.proname;
```

After both files, the function list should be `begin_cloud_nine_checkout` and `seller_plan_status`. Maya's existing owner receives the organization `מאיה לוי` and the active Social plan at 0 agorot, which publishes without a charge. Branded and Scale are stored with no price, so this file cannot subscribe Maya to them.

Until `20261122240000_seller_plan.sql` is applied, `seller_plan_status` is missing and the studio still lets the linked Maya account publish. After it is applied, publish requires that active zero-price Social subscription.

## Requirement map

| ID | Status | Evidence and the operation still blocked |
|---|---|---|
| FR-IAM-001 | sandbox verified; live partial | `allow` covers seller publish, consumer order, supplier pick, and admin payout. Live quote and publish RPCs check the signed-in user. A full role check on every future admin API is not built. |
| FR-IAM-002 | sandbox verified; live blocked | `secondApproval` rejects one person approving their own payout-destination override. Live operation blocked: recording a real payout-destination change. Dependency: no payout provider. |
| FR-IAM-003 | development queue only | `/supplier` lets a warehouse role pick, pack, label, and dispatch a sandbox order. Operation blocked: a live warehouse task feed. Dependency: no attested warehouse actor. |
| FR-SUB-001 | partial | Email sign-in and the Maya claim exist. Operation blocked: enabling paid checkout. Dependency: legal identity, tax status, and a PSP account are not collected. |
| FR-SUB-002 | partial | `/register/supplier` stores a pending application and `/admin/approvals` can approve a complete one. Operation blocked: vetting a warehouse. Dependency: no sample shipment. |
| FR-SUB-003 | sandbox verified; database gate written | Social publish is allowed at price 0. Campaign and dedicate are refused. The database function is in `20261122240000` and passed on local PGlite. storey-dev does not have it yet. |
| FR-SUB-004 | sandbox verified for the zero plan | Social activation charges 0. A priced plan returns `BLOCKED_NO_PSP`. Operation blocked: charging Branded or Scale. Dependency: no approved rate and no PSP. |
| FR-SUB-005 | sandbox verified; live blocked | `quoteUpgrade` rounds once. Confirmed payment of a priced plan does not change the plan. Operation blocked: taking an upgrade payment. Dependency: no PSP. |
| FR-SUB-006 | sandbox verified | `applyScheduledPlan` keeps the old plan until the boundary. Live storefront downgrade is not wired because Maya has one zero plan. |
| FR-SUB-007 | sandbox verified | Checkout and campaign close 72 hours after past due. Operation blocked: a renewal charge and the retry. Dependency: no PSP invoice. |
| FR-SUB-008 | blocked | Operation blocked: showing a provider invoice. Dependency: no PSP event. |
| FR-CAT-001 | implemented for the development catalog | `/admin` stages a supplier CSV. `/admin/staging` approves or ignores a row. Invalid packs are rejected. This is not a supplier API. |
| FR-CAT-002 | sandbox verified | The same batch key replays. Changed content returns `CONFLICT`. A partial batch leaves other live rows. |
| FR-CAT-003 | partial | Offer, listing, and pool tables are separate. Publication in the sandbox blocks missing rights. The live Cloud Nine listing does not yet check an image-rights record. |
| FR-INV-001 | partial | Database pools are shared free and safety buffer. Campaign, dedicated, committed, and quarantine quantities are in the in-memory book only. |
| FR-INV-002 | sandbox verified | Campaign isolation is covered by `tests/commerce.test.ts`. Not run in Postgres. |
| FR-INV-003 | development catalog only | `/admin` applies absolute counts by SKU and warehouse, rejects old sequences, gaps, conflicts, and counts below open holds. Operation blocked: applying an attested warehouse snapshot. Dependency: no warehouse attestation. |
| FR-INV-004 | sandbox verified | Social dedicate is rejected. Campaign expiry returns unused units once in memory. |
| FR-INV-005 | blocked | Operation blocked: marking dedicated stock after a destination scan. Dependency: no warehouse scan. |
| FR-INV-006 | app verified; SQL verified locally | The buyer button is the only hold. The local two-client test passed. storey-dev still exposes the old combined function until `20261122230100` is applied. |
| FR-INV-007 | SQL verified locally | Expiry release returned the pack once. The second call returned 0. |
| FR-INV-008 | sandbox verified; live blocked | `warehouseCheckout` closes after five minutes without a heartbeat. Operation blocked: closing live checkout. Dependency: no supplier heartbeat. |
| FR-INV-009 | blocked | Operation blocked: releasing a pending physical move. Dependency: no scan. |
| FR-FIN-001 | partial | The seller card shows wholesale, retail, and gross profit. On `weekly-2026-11` a published basis-point rate shows the creator fee. No rate is approved for production. |
| FR-FIN-002 | blocked | Operation blocked: applying a GMV cost. Dependency: no approved schedule. |
| FR-FIN-003 | partial | Prices are integer agorot. There is no multi-line discount to allocate. |
| FR-FIN-004 | partial | A saved quote keeps its price. `weekly-2026-11` also snapshots commission rates, tariff version, freight, sponsor and per-unit agorot. Tax stays uncalculated unless the quote already carries it. |
| FR-FIN-005 | blocked | Operation blocked: authorizing or capturing a live charge. Dependency: no PSP contract. |
| FR-FIN-006 | sandbox verified | The zero-tax 110 fixture balances. It is not posted to a database or a PSP. |
| FR-FIN-007 | blocked | Operation blocked: funding a prepaid lot. Dependency: no lot contract. |
| FR-FIN-008 | sandbox verified; live blocked | `pay-2026-11` still waits seven days. `weekly-2026-11` becomes eligible on verified delivery and aggregates one weekly payout per beneficiary. The maker is audited. The same actor cannot set `bank_paid`. The finance button only simulates completion. Operation blocked: a live bank payout. Dependency: no PSP confirmation. |
| FR-FIN-009 | blocked | Operation blocked: putting a tax amount on a quote. Dependency: no approved tax determination. |
| FR-FIN-010 | blocked | Operation blocked: closing a daily reconciliation. Dependency: no PSP balance. |
| FR-WEB-001 | partial | `/s/maya/cloud-nine` can be copied and shared. The link is not opaque or revocable. |
| FR-WEB-002 | partial | The Social Club studio exists for Maya. There is no versioned theme release. |
| FR-WEB-003 | blocked | Operation blocked: serving a custom domain. Dependency: no DNS challenge. |
| FR-WEB-004 | partial | The cart is still one seller line. `weekly-2026-11` quotes freight, a delivery window and a blocking reason before payment. Pickup must be chosen explicitly. A carrier SLA is not connected. |
| FR-WEB-005 | sandbox partial; live blocked | Hosted PayMe checkout can open one sandbox authorization when the partner key, seller mapping, and public https callback exist. The external charge has not been run. The local button still starts the hold. Operation blocked: a live charge. Dependency: no production PSP approval. |
| FR-WEB-006 | partial; seller report blocked | A qualified visit can be stored locally while `STOREY_EXPERIMENT_FIRST_SHARE` is enabled. Creator, supplier, admin, and link-preview crawlers are excluded. Sellers do not see visits, checkout starts, refunded merchandise, or net GMV. Operation blocked: that seller report. Dependency: no analytics store. |
| FR-ORD-001 | sandbox verified | Two supplier lines route into separate groups, lowest freight first. |
| FR-ORD-002 | sandbox verified; live blocked | Capture is idempotent in memory. Operation blocked: converting a hold to a commitment after a PSP capture. Dependency: no PSP. |
| FR-ORD-003 | blocked | Operation blocked: acknowledging a fulfillment order. Dependency: no warehouse outbox. |
| FR-ORD-004 | sandbox verified | A repeated shipment key does not increase shipped quantity. A short pick is not a live task. |
| FR-ORD-005 | blocked | Operation blocked: sealing a parcel. Dependency: no packaging scan. |
| FR-ORD-006 | blocked | Operation blocked: buying a label. Dependency: no carrier account. |
| FR-ORD-007 | sandbox verified | The repeated handoff does not move the same units twice. Operation blocked: accepting a carrier scan. Dependency: no carrier. |
| FR-ORD-008 | sandbox partial | `weekly-2026-11` shows the supplier tariff window before payment. Operation blocked: a carrier SLA or a live arrival event. |
| FR-ORD-009 | sandbox verified | Rejecting the unshipped remainder refunds only that remainder. A live stop-confirmation is not available. |
| FR-ORD-010 | blocked | Operation blocked: showing a customer shipment status. Dependency: no parcel events. |
| FR-RET-001 | sandbox verified | A return cannot exceed delivered units minus open returns. |
| FR-RET-002 | blocked | Operation blocked: scanning an RMA receipt. Dependency: no warehouse scan. |
| FR-RET-003 | sandbox verified | Inspection splits sellable and quarantine units. It does not move a database pool. |
| FR-RET-004 | sandbox verified | A refund cannot exceed the capture. The second refund is refused. |
| FR-RET-005 | blocked | Operation blocked: reversing a provider transfer. Dependency: no PSP transfer. |
| FR-RET-006 | blocked | Operation blocked: opening a dispute case. Dependency: no PSP dispute event. |
| FR-RET-007 | blocked | Operation blocked: sending a return decision. Dependency: no mail provider and no case record. |
| FR-ING-001 | blocked | Operation blocked: fetching a supplier catalog. Dependency: no source credential. The sandbox stages rows that are already in memory. |
| FR-ING-002 | sandbox verified | Import stays off the live list until `publishStaged`. |
| FR-ING-003 | sandbox verified | Missing tax class blocks publication. No live cost rule table. |
| FR-ING-004 | partial | The sandbox row requires Hebrew and English titles. There is no enrichment queue. |
| FR-ING-005 | blocked | Operation blocked: generating a studio image. Dependency: no image provider. |
| FR-ING-006 | sandbox verified | Missing rights block publication. There is no curator login. |
| FR-ING-007 | sandbox verified | A stale revision returns `STALE`. A repeated identical batch does not create a second live offer. |
| FR-EXC-001 | sandbox verified; SQL verified locally | The second buyer of the last pack gets `stock changed`. |
| FR-EXC-002 | blocked | Operation blocked: stopping holds after a shrink report. Dependency: no warehouse count. |
| FR-EXC-003 | sandbox verified | The downgrade waits for the paid-through boundary. |
| FR-EXC-004 | blocked | Operation blocked: disposing a dedicated lot. Dependency: no lot and no scan. |
| FR-EXC-005 | sandbox verified | Three of five can ship, and the other two refund their merchandise share. The unshipped supplier refunds its freight. |
| FR-EXC-006 | partial | The inbox keeps the saved unit price and says when the current published price differs. |
| FR-EXC-007 | sandbox verified | One payment key posts once. A changed payload conflicts. |
| FR-EXC-008 | blocked | Operation blocked: opening a carrier claim. Dependency: no carrier. |
| FR-API-001 | blocked | Operation blocked: accepting a WMS snapshot. Dependency: no warehouse credential. |
| FR-API-002 | blocked | Operation blocked: delivering a fulfillment outbox event. Dependency: no warehouse endpoint. |
| FR-API-003 | blocked | Operation blocked: verifying a signed event. Dependency: no signing secret. |
| FR-API-004 | sandbox partial; live blocked | `POST /payme/callback` checks the partner signature, re-reads the sandbox sale, and ignores a duplicate, a bad signature, a failed sale, and a cancellation. It does not call a live host. Operation blocked: a production webhook. Dependency: no production PSP. |
| FR-API-005 | blocked | Operation blocked: quoting live freight or tax. Dependency: no carrier or tax adapter. |
| FR-API-006 | blocked | Operation blocked: showing an operator timeline. Dependency: no event store. |
| FR-API-007 | blocked | Operation blocked: mapping an integration tenant. Dependency: no external account. |
| NFR-PER-001 | blocked | Operation blocked: a load-test claim. Dependency: no load run. |
| NFR-PER-002 | blocked | Operation blocked: an availability claim. Dependency: no measurement. |
| NFR-OPS-001 | blocked | Operation blocked: reporting WMS lag. Dependency: no WMS. |
| NFR-OPS-002 | blocked | Operation blocked: a restore drill. Dependency: no backup run. |
| NFR-SEC-001 | partial | RLS is on and base tables are not granted to anon. MFA is not tested. |
| NFR-SEC-002 | partial | Card data is not collected. Operation blocked: a card field. Dependency: no PSP. |
| NFR-PRV-001 | partial | The public page omits the customer address and seller cost. A deletion request is not implemented. |
| NFR-UX-001 | partial | Checkout was checked at 360 px in an earlier session. A WCAG audit is not done. |
| AT-01 | SQL verified locally | One hold, one refusal, one replay, one release. Not run on storey-dev. |
| AT-02 | sandbox verified | Campaign isolation. Not in Postgres. |
| AT-03 | blocked | Operation blocked: selling a prepaid lot. Dependency: no lot funding. |
| AT-04 | sandbox verified | Two supplier lines route and refund separately. No live second supplier. |
| AT-05 | blocked | Operation blocked: changing cost during a hold. Dependency: no cost schedule. |
| AT-06 | sandbox verified | Zero-tax capture and refund cap. The processing-fee remainder is not posted. |
| AT-07 | sandbox partial; live blocked | A repeated sandbox callback does not add a second journal. A failed callback does not capture. Operation blocked: replaying a live webhook. Dependency: no production PSP. |
| AT-08 | partial | Social dedicate is rejected in the sandbox. A custom domain is not implemented. |
| AT-09 | blocked | Operation blocked: applying a GMV band. Dependency: no approved schedule. |
| AT-10 | blocked | Operation blocked: showing an approved tax amount. Dependency: no tax determination. |
| AT-11 | blocked | Operation blocked: scanning a pack or buying a label. Dependency: no warehouse scan and no carrier. |
| AT-12 | blocked | Operation blocked: resolving a dispute. Dependency: no PSP dispute. |
| AT-13 | sandbox verified | Two identical imports keep one staged identity and no live row before approval. |
| AT-14 | blocked | Operation blocked: generating lifestyle images. Dependency: no image provider. |
| AT-15 | sandbox verified | A stale publish revision is rejected. There is no live concurrent publisher session. |

## Still outside this release

Cross-border duty, multi-seller carts, multi-currency, automated substitution, external storefront plugins, ad purchases, recurring consumer orders, and a general warehouse system stay unbuilt.

## Next operation that is not blocked by a missing contract

Apply `supabase/migrations/20261122230100_begin_checkout.sql`, then `supabase/migrations/20261122240000_seller_plan.sql`, then rerun the read-only query above. After that, the buyer button can hold stock on storey-dev and the linked Maya account publishes under the zero-price Social plan.
