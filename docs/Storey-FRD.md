# Storey | Functional Requirements Document

## 1. Document control and executive summary

| Field | Value |
|---|---|
| Baseline | v1.2 · 22 November 2026 · proposed for implementation review |
| Accountable owner | Marketplace Product |
| Review owners | Engineering, Supplier Operations, Finance, Risk, Customer Support |
| Release | Domestic pilot with one vetted fulfillment supplier and all three seller tiers |
| Change control | Product owns requirement IDs. Changes to stock ownership, fee incidence or payout release require review by Engineering, Operations and Finance. Retain superseded policy versions for existing transactions. |
| Interpretation | Each identified row is a mandatory behavior or testable service target. Numeric policy defaults are proposed pilot settings. Commercial rates and jurisdiction-specific rules require approval before live sales. |

Storey lets a creator sell a party kit from a WhatsApp link today and launch a branded store using the same catalog and fulfillment relationship later. The seller sets the consumer price. The supplier stores and ships the goods. Storey coordinates the promise made at checkout, the warehouse work needed to keep it, and the distribution of the payment.

| Persona | Outcome | Evidence of success |
|---|---|---|
| Creator / seller | Earn a margin without purchasing shared stock upfront. Reserve stock or negotiate warehouse capacity as demand grows. | Can publish a priced item, see expected proceeds, and reconcile actual earnings to a payout. |
| Supplier / 3PL | Convert warehouse capacity and wholesale inventory into orders with explicit packing and dispatch instructions. | Can reconcile every unit and payment to a SKU, warehouse, fulfillment line and settlement. |
| End consumer | Understand whom they are buying from, delivery timing and total cost before payment. | Receives one confirmation, parcel-level tracking and a route to a refund for each line. |
| Platform admin | Control admission, commercial policies and exceptions with evidence. | Can trace a customer charge to stock movements, shipments, refunds and beneficiary balances. |

**Pilot scope.** One selling country, settlement currency, seller per checkout and anchor supplier. Party supplies, event decor and celebration goods use ordinary supplier offers with variant, pack and occasion attributes. Support both a supplier portal and a versioned WMS interface. Build supplier and warehouse partitioning, split shipments and settlement at launch. Certify a two-supplier fixture before enabling a second live supplier. Suppliers may be wholesalers, warehouse-capable retailers or approved fulfillment agents acting for an identified stock owner.

**Outside this release.** Cross-border duty calculation, multi-seller carts, multi-currency settlement, automated supplier substitution, external storefront plug-ins, campaign advertising purchases, recurring consumer orders and a general-purpose warehouse management system.

### Tier feature comparison

| Capability | Social Seller | Branded Store | Scale Partner |
|---|---|---|---|
| Social / WhatsApp links and hosted checkout | Included | Included | Included |
| Stock commitment | Shared stock, pay wholesale per captured order | Shared stock plus expiring campaign reservations | Shared stock plus reservations and contract-backed dedicated stock |
| Storefront | Product checkout landing page | White-label catalog, logo, custom domain | Same storefront capabilities |
| Wholesale pricing | Supplier base | Automated qualifying GMV tier | Eligible GMV or negotiated bulk schedule under the precedence rule in FR-FIN-002 |
| Packaging | Supplier standard | Supplier standard | Approved packaging and inserts by contract |
| Fulfillment promise | Supplier standard | Supplier standard | Effective-dated SLA by warehouse and service |
| Subscription charge | Configured plan rate | Configured plan rate | Contracted rate and billing terms |

### Selected creator interface — Social Club

**Design decision · 22 November 2026.** Use Social Club for the seller workspace across Social Seller, Branded Store and Scale Partner. Show the seller’s current tier as a small text label. Customer-facing storefront branding follows FR-WEB-002. The approved visual reference is the [Social Club screen in the Storey Creator Gallery](https://chatgpt.com/library?file_id=libfile_98d784b7377c8191863908bef91647a0&account_id=personal).

| Creator task | Interface requirement |
|---|---|
| Choose a product or kit | Lead with product imagery, a short title and the sell unit or pack size. Use a light lavender surface, dark plum text and cobalt-violet primary actions. Stack content in reading order on mobile. |
| Set a retail price | Group wholesale cost, editable retail price and per-unit gross profit in one pricing block. Calculate gross profit from net retail less net wholesale. Present gross margin and expected proceeds after fees and fulfillment according to FR-FIN-001. |
| Share a published listing | Make **Share on WhatsApp** the primary action and **Copy link** the secondary action. Both use the same seller-attributed URL from FR-WEB-001. Keep wholesale cost and seller earnings private in the shared preview. |

**Design acceptance.** At a 360 px viewport, a seller can inspect the pack size, change the price, read the updated figures and reach both sharing actions without horizontal scrolling. For the gallery’s Cloud Nine example, net wholesale of ₪24 and net retail of ₪59 produce ₪35 gross profit per pack. Changing net retail to ₪65 updates gross profit to ₪41.

## 2. Personas and access control

**FR-IAM-001** Enforce the matrix on every API call, export, background job and administrative action. Authenticate the actor and derive tenant membership server-side. Bind guest actions to the order using an expiring, purpose-scoped token and verified email challenge for sensitive changes. Deny unlisted grants by default. A company acting as both seller and supplier selects an explicit operating role.

| Operation | Creator / seller | Supplier / 3PL | End consumer | Platform admin |
|---|---|---|---|---|
| Apply, submit verification, change settlement account | Own seller account | Own supplier account | — | Review verification status, suspend |
| Manage plans, agreements and price schedules | Select plan, accept own agreement | Propose own commercial terms | — | Publish versioned plans and approve agreements |
| Ingest catalog, costs and stock | Read eligible wholesale offers | Maintain assigned offers, warehouse and bins | Published retail content only | Approve, quarantine or delist |
| Set retail price, publish links, manage domains | Manage own listings within tier | — | Open published channels | Suspend publication with reason |
| Reserve / dedicate / release stock | Request and release own eligible quantities | Confirm physical moves and disposition at assigned warehouse | — | Resolve discrepancies under approval |
| Place and inspect order | Read own store orders | Read assigned fulfillment lines and necessary ship-to fields | Place order, read own receipt | Support-scoped inspection |
| Pick, pack, create labels and dispatch | Read progress | Execute assigned shipment | Track own shipment | Requeue or place hold with reason |
| Return, refund or dispute | Review own cases, approve within policy | Inspect assigned returns, submit evidence | Request, upload evidence, track own case | Decide escalations, authorize adjustments |
| View financials | Own price, fees, proceeds and statement | Own costs, charges and remittance | Own paid totals, invoices and credits | Finance-scoped ledger and reconciliation |
| Manage platform users, audit or configure integrations | Manage own seller memberships | Manage own supplier memberships and scoped WMS keys | — | Scoped access administration and audit |

**FR-IAM-002** Admin grants distinguish support, risk, operations and finance. Two distinct authorized actors must approve manual payout destination overrides, stock ownership transfers and manual journal adjustments. Log initiator, approver, scope, reason, timestamp and before/after references. Historical journal entries are immutable.

**FR-IAM-003** Warehouse staff receive only assigned tasks, necessary delivery details and packing instructions. Mask consumer contact data after the operational retention window. Export permissions inherit field and row restrictions. Revoke sessions and machine credentials on tenant suspension while allowing staff-controlled resolution of existing orders.

## 3. Functional requirements

### A. Onboarding, subscriptions and tier enforcement

| ID | Required behavior |
|---|---|
| FR-SUB-001 | Register seller with verified email, legal identity, business and tax status, operating country, settlement currency, payment-provider account reference and timestamped acceptance of versioned terms. Allow drafts during review. Enable paid checkout only after provider verification, plan activation and merchant policy approval. Show blocking reason and remediation action. |
| FR-SUB-002 | Vet supplier identity, stock ownership or agency authority, verified beneficiary, warehouse addresses, shipping zones, cutoff calendar, return address, inventory source and capacity. Require ops approval after a sample order, tracking event, stock reconciliation and return pass. Apply approval per warehouse and service area. |
| FR-SUB-003 | Resolve entitlements from seller, plan version, paid-through time and active supplier contract. Apply gates on publish, checkout, reservation, stock move and pack instruction creation. Return 403 FEATURE_UNAVAILABLE for prohibited writes. Record the entitlement version used for each order. |
| FR-SUB-004 | Bill the configured recurring charge in advance at activation and each billing anniversary. Store cycle boundaries in UTC. Anchor short months to their last day. Tax and invoice subscription fees separately from merchandise. Create one invoice per seller, cycle and adjustment type. A zero-rate plan activates without a charge. |
| FR-SUB-005 | Quote an immediate upgrade using remaining seconds divided by cycle seconds times the plan-price difference, rounded once to minor units plus applicable tax. Activate on confirmed payment or approved zero balance. Failed or abandoned upgrades retain prior entitlements. Contract-only features also require signed effective terms. |
| FR-SUB-006 | Schedule downgrade or cancellation for the paid-through boundary. Preview expiring reservations, affected domains, active orders and dedicated balances before acceptance. Apply the stock disposition rules in §5. Preserve order history, returns and outstanding settlement access. |
| FR-SUB-007 | On renewal failure enter Past due, notify seller and schedule retries at +1 and +3 days. At 72 hours restrict new checkout and campaign creation if still unpaid. Serialize retry confirmation and suspension against invoice status. Resume future sales after payment if merchant verification remains valid. |
| FR-SUB-008 | Show billing history, next charge, effective plan and pending transitions. Deduplicate provider events by provider event ID and business invoice key. Apply late callbacks to their originating invoice. A superseded payment cannot reactivate a cancelled plan. |

### B. Wholesale catalog and inventory

| ID | Required behavior |
|---|---|
| FR-CAT-001 | Accept validated CSV or authenticated batch API upserts keyed by supplier ID and supplier SKU. Require title, variant, sell unit, units per pack, price, currency, tax class, dimensions, weight, fulfillment location and active flag. Accept optional GTIN, media rights, color, theme, occasion and material. Reject nonpositive pack size, negative cost and unknown units. A sellable pack is one checkout unit. |
| FR-CAT-002 | Stage each import, return row number, field and reason for invalid data, and publish accepted rows under a batch version. Replaying the same batch and content returns its original result. A reused key with altered content returns 409. Missing rows in a partial feed retain their previous state. Explicit retirement stops new sales and preserves historical references. |
| FR-CAT-003 | Keep supplier offer, seller listing and warehouse inventory as separate records. One listing binds to exactly one offer and sell unit. Carry approved images, warnings and pack count into the listing. Block publication for missing rights, safety attributes required by category, invalid shipping profile or inactive offer. |
| FR-INV-001 | Maintain quantities by stock owner, supplier, warehouse, SKU and pool. Record mutually exclusive quantities for free, campaign-reserved, checkout-held, committed and quarantined units. Dedicated free stock has a seller owner or exclusive beneficiary and bin reference. Report physical on-hand as their sum, including committed units awaiting dispatch. Shipped units leave on-hand. |
| FR-INV-002 | Shared sellable units equal max(0, shared free minus safety buffer). Eligible campaign links consume their own reservation first, then shared units if the campaign allows overflow. Other channels cannot consume campaign units. For Scale orders consume own dedicated free units first, then eligible campaign and shared units only if contract permits fallback. Preserve source segments per order line. |
| FR-INV-003 | Accept sequenced, absolute warehouse counts including unshipped commitments. Require warehouse, SKU, pool, counted quantity, timestamp and movement watermark. Reconcile with movements after the watermark and preserve outstanding Storey claims. Reject old versions, deduplicate events, and halt affected sales on sequence gaps or unexplained deficits. Never subtract the same dispatch twice. |
| FR-INV-004 | Campaign request includes seller, campaign, offer, warehouse, quantity and expiry. Validate positive integer, Branded or Scale entitlement, contractual cap, availability and TTL (pilot maximum 72 hours). Atomically move shared free units to the seller's campaign pool. Reject the entire request if insufficient. On expiry release unused units once. Active checkout holds retain their own expiry. |
| FR-INV-005 | Dedicated allocation requires an active contract specifying owner, beneficiary, quantity, bin, funding model and disposition. Pilot supports supplier-owned pay-on-sale and seller-prepaid lots. Remove units from shared availability into a pending-move hold, issue a warehouse transfer and mark dedicated only on verified destination scan. Mismatch opens a reconciliation case and blocks affected units. |
| FR-INV-006 | Create a 10-minute checkout hold with hold ID, quote ID, source segments and expiry. Lock stock records in stable order or use conditional version writes. Grant all requested cart lines or release all. Enforce held plus committed quantities within verified capacity. Cart views, link previews and crawler requests create zero holds. |
| FR-INV-007 | Release expired or cancelled holds to their origin when eligible. Expired campaigns return units to shared free. Dedicated units return to their original lot. Log movement ID, actor, source, destination, quantity and business reference for every movement. |
| FR-INV-008 | Require supplier heartbeat at least every 60 seconds and a daily full count reconciliation. At five minutes without a valid heartbeat, close checkout for the affected warehouse and alert operations. Portal-only warehouses must use a Storey-exclusive pool with every movement recorded in the portal and daily count attestation. An overdue attestation blocks new sales. |

### C. Pricing, margins and financial ledger

| ID | Required behavior |
|---|---|
| FR-FIN-001 | Version costs by offer, currency, sell unit, effective interval and tax basis. Reject overlapping versions of the same schedule. Seller chooses fixed retail price or cost markup m, where net retail = net wholesale × (1 + m). Show merchandise gross margin = (net retail − net wholesale) / net retail, plus expected proceeds after fees and fulfillment. Require positive retail and nonnegative expected proceeds at publish and quote. |
| FR-FIN-002 | For each seller and supplier, calculate trailing 30-day eligible GMV from captured net merchandise less merchandise refunds posted during that window, excluding tax, freight and fees. Refresh hourly. Apply the greatest qualifying inclusive threshold to subsequent quotes. For Scale, compute any contracted bulk price using eligible SKU units in the submitted order or signed lot purchase, as specified in the schedule. Use the lower eligible net unit cost across base, GMV and bulk schedules. Discounts do not stack. Snapshot basis, threshold, cost and schedule IDs. |
| FR-FIN-003 | Accept integer minor units and ISO currency at financial boundaries, decimal precision for intermediate calculations, and market-configured tax rounding. Allocate order discounts by proportional net merchandise value with largest remainders and stable line-ID ties. Allocate partial credits from original line balances. The final unit receives outstanding rounding residue. Reject mixed-currency carts. |
| FR-FIN-004 | Build an immutable quote with quantities, retail, discount payer, wholesale cost, shipping charged and payable, packaging, platform fee, tax per component, processor-fee bearer, policy versions and expiry. Platform fee = configured take-rate × discounted merchandise net of tax, excluding freight. Pilot assigns payment processing fees to Storey. Seller-funded discounts reduce seller proceeds. MVP disables unconfigured subsidy types. |
| FR-FIN-005 | Use a marketplace payment service provider (PSP) for authorization, capture, beneficiary verification and deferred transfers. Persist separate customer charge, beneficiary liability, transfer and bank payout IDs. Use regulated escrow terminology only for a separately contracted escrow product. Block activation for a country, currency or funds flow lacking written provider approval. |
| FR-FIN-006 | On capture, post one balanced journal per currency. Debit PSP clearing for gross collected. Credit supplier payable for wholesale due, fulfillment and supplier taxes, platform revenue and applicable fee tax, designated tax liabilities where Storey remits, and seller payable for the residual. Seller-remitted consumer tax stays in seller payable and is itemized. Assign each amount exactly once. Post actual PSP fees as platform expense against clearing. Reverse through linked compensating journals only. |
| FR-FIN-007 | For prepaid dedicated stock, record lot funding and supplier settlement on confirmed purchase. At retail sale, show lot cost in seller margin and exclude already funded cost from the supplier payable. Charge separately contracted handling and freight. For supplier-owned dedicated stock accrue wholesale at capture. Record lot ID and cost basis on every consumed unit. |
| FR-FIN-008 | Evaluate payout eligibility per delivered line after the contract hold (pilot seven calendar days), PSP availability, verification, reserve minimum and case holds. Run daily. Transfer only positive eligible balances less authorized offsets, with a unique beneficiary/currency/batch key. Mark bank payout paid only on provider confirmation. Failed transfers stay payable. Reconcile retries against the provider before reissuing. |
| FR-FIN-009 | Configure seller as proposed retail merchant and supplier as wholesale vendor, subject to launch-market approval. Store registration IDs, country, ship-to jurisdiction, product tax class, exemptions, tax-inclusive display flag, rate version, document issuer and remitter. Calculate retail, wholesale, shipping, subscription and platform-service tax independently. On missing determination block the quote. Issue numbered receipts, invoices and linked credit documents under the approved issuer rules. |
| FR-FIN-010 | Reconcile daily by currency across captures, refunds, disputes, fees, transfers, bank payouts and PSP balances. Show opening balance + movements = closing balance for each beneficiary. Unmatched entries create aged exceptions with owner and provider reference. Freeze affected release amounts until resolved. Export transaction-level statements for seller, supplier and finance. |

**Settlement example.** In a zero-tax test fixture the customer pays 110, comprising 100 merchandise and 10 freight. Wholesale is 60, supplier freight is 10, and the take-rate is 5%. Capture credits supplier 70, seller 35 and platform 5. A processing fee of 2 reduces platform earnings to 3. For an otherwise identical prepaid lot the supplier receives 10 from the retail capture and the seller receives 95. The seller previously paid 60 for the unit, so economic proceeds after that cost are 35 in both cases.

### D. Storefront and social commerce

| ID | Required behavior |
|---|---|
| FR-WEB-001 | Generate an opaque, revocable HTTPS link bound to seller, listing or campaign, allowed quantity, attribution and optional expiry. Provide copy and WhatsApp share actions with URL-encoded text. Resolve prices, eligibility and stock server-side. Strip personal data from preview metadata. An expired link displays an ended page, a sold-out link displays availability, and neither accepts payment. |
| FR-WEB-002 | Provide draft, preview and publish for logo, accessible colors, catalog collections, home copy, policies and contact details. Sanitize rich text, validate uploaded media and restrict themes to approved components. Publishing swaps to a versioned release atomically. Rollback restores the prior release subject to current eligibility. Show the seller's legal identity at checkout. |
| FR-WEB-003 | Verify custom-domain control using a unique DNS challenge before binding. Enforce unique normalized hostname, issue and renew managed TLS, require HTTPS, and serve only after a valid certificate exists. Track Pending DNS, Provisioning, Active and Failed with remediation. Keep platform checkout available during provisioning. Reverify ownership before any reassignment. |
| FR-WEB-004 | Scope cart to one seller and currency. Reject cross-seller add with a separate-cart option. Require positive integer quantities within offer limits, a supported address, delivery method per shipment group and explicit acceptance of displayed policies. Show pack sizes, taxes, freight, merchant identity, delivery window and parcel split before payment. Preserve valid cart lines on validation errors. |
| FR-WEB-005 | Final submit requires unexpired quote, live hold, server-computed total, consent version and idempotency key. A changed total, service promise or quantity requires an updated summary and fresh confirmation. Redirection after PSP authentication displays pending until backend confirmation. Send one confirmation per accepted order with shipment groups and authenticated order-access link. |
| FR-WEB-006 | Show sellers link visits, checkout starts, captured orders, refunded merchandise and net GMV by link/campaign. Assign the last eligible Storey link within the same seller session before checkout. Record the attribution on the order and exclude link-preview bots from conversion counts. |

### E. Order routing and 3PL operations

| ID | Required behavior |
|---|---|
| FR-ORD-001 | Before pricing freight, route each line to an eligible offer warehouse using serviceability, stock entitlement and promised dispatch date, then lowest quoted freight and warehouse ID as tie-breakers. Group by supplier, warehouse, ship-to and compatible service/packing profile. One retail order contains one or more fulfillment orders (FOs). Persist quantity, stock source and money allocation per FO line. |
| FR-ORD-002 | Authorize against the quote, atomically convert valid cart holds to commitments and create the pending parent and children, then request capture. Release the FO to the warehouse only after verified capture and balanced journal. On definite capture failure release commitments and void authorization. On unknown result freeze commitments, query PSP and alert after five minutes. A late capture after cancellation enters compensation and is refunded once. |
| FR-ORD-003 | Dispatch each paid FO via transactional outbox to its assigned portal or WMS. Require acknowledgment by the configured SLA. Retry unacknowledged delivery with the same FO ID. Timeout alerts supplier and ops. A reject requires quantity and reason, starts a shortage case and freezes affected payout. |
| FR-ORD-004 | Pick task lists bin, lot, SKU, variant, sell units and pack quantity. Scan item and bin, validate quantities against outstanding commitment, and record picker/time. A short pick creates an exception. Substitution requires a new customer-approved transaction. |
| FR-ORD-005 | Snapshot contract-specific packaging BOM, insert version, quantity, branding instructions and handling charge per FO. Reserve packaging consumables with the order when mandatory. Confirm scans before sealing. Missing mandatory materials block packing and alert seller. Allow standard-pack fallback only with recorded contractual consent and any required fee reversal. |
| FR-ORD-006 | Validate carrier service, address, parcel dimensions and weight. Request label by shipment idempotency key. Store tracking number, label, carrier and cost. If a response is lost query by shipment reference. Void unused labels before replacement and record charges/credits separately. Label purchase alone cannot release inventory or payout. |
| FR-ORD-007 | At physical handoff record parcel manifest, per-line quantities and handoff evidence. Decrement on-hand and commitments exactly once. Accept carrier tracking by signed event or authenticated polling. Map accepted, in transit, delivered, exception and returned-to-sender events to parcels. Preserve raw event reference and occurrence time. Late scans cannot overwrite a verified delivery without an audited correction. |
| FR-ORD-008 | Compute dispatch and delivery deadlines from warehouse timezone, cutoff, business calendar and versioned SLA. Show customer an estimated arrival range before payment. If a required event date is supplied, refuse services whose latest estimate is later. Notify seller and customer on delay, partial shipment, delivery or cancellation with affected quantities and revised estimate if known. |
| FR-ORD-009 | Permit pre-handoff cancellation only after supplier stop confirmation for released work. Lock against concurrent handoff. Void unused labels and return stock to origin when recovered. If handoff wins, route the request to returns. Isolate exceptions to affected lines. |

### F. Returns, refunds and dispute resolution

| ID | Required behavior |
|---|---|
| FR-RET-001 | Accept an authenticated request with order line, delivered quantity, reason, requested remedy and evidence if policy requires it. Validate against delivered units less open and completed return quantities, original policy version and market overrides. Route defects, missing parcels and change-of-mind to their configured paths. Display eligibility, next action and decision deadline. |
| FR-RET-002 | On approval create one RMA reference per return destination, label or drop-off instructions, item quantities, freight payer and expiry. Supplier scans receipt and grades each unit as sellable, damaged, incomplete or wrong item. Record photos and operator. Wrong or unverified goods enter quarantine. A missing return scan raises a trace case. |
| FR-RET-003 | Sellable returns restore the originating shared or dedicated lot after inspection. Former campaign units return to shared free after campaign expiry. Seller-prepaid goods remain attributed to that seller, including after downgrade. Damaged returns enter segregated quarantine pending write-off, repair or claim. Post receipt and disposition once per RMA unit. |
| FR-RET-004 | Refund according to approved trigger (cancellation, inspection, missing-parcel decision or mandatory deadline). Compute merchandise, allocated discount, tax and eligible shipping from the original charge. A full covered cancellation includes unperformed fulfillment charges. Post linked reversals against the original beneficiaries per liability policy. Never exceed captured amount less prior refunds and overlapping dispute recoveries. |
| FR-RET-005 | If already transferred, request a provider transfer reversal or offset future beneficiary balances under agreed terms. Record any shortfall as a receivable, assign collection owner and hold further payouts subject to contract. Fund an approved consumer refund by its deadline even if supplier recovery is pending. Retry uncertain refunds only after querying PSP status. |
| FR-RET-006 | A PSP dispute opens a case with reason, amount, evidence deadline, owner and linked charge lines. Freeze the disputed amount, attach consent, shipment and communications, and track submitted/won/lost. Correlate refund and dispute events to prevent duplicate consumer compensation. Release reserve on win. On loss allocate principal and dispute fees to responsible parties under the snapshotted agreement. |
| FR-RET-007 | Notify the customer of approval, rejection with reason and appeal route, receipt and refund confirmation. A support override requires reason, evidence and authorized scope. Record promised and actual timestamps for supplier response, inspection and reimbursement. |

### G. Admin catalog ingestion and AI enrichment

**Release scope.** Supplier website selection and AI studio photography are included in this extension. The pilot uses one approved supplier source. Qualify each additional connector against the same import contract before enabling it.

| ID | Required behavior |
|---|---|
| FR-ING-001 | Admin registers a supplier-authorized source, allowed hosts and paths, credential reference, currency and tax basis. Adapters include Shopify Admin/Storefront, WooCommerce REST, Konimbo/CashCow partner feeds or approved APIs, XML/JSON and Merchant Center feeds, and sitemap discovery with Product JSON-LD/HTML fallback. Preserve source timestamps, variant IDs, SKUs, media and source checksums. Restrict fetches and redirects to authorized public hosts, limit concurrency and page count, respect access restrictions and expose per-page errors. Store credentials in a secret manager. |
| FR-ING-002 | Import creates review-only records. Filter by category, source stock, price, status and text. Bulk actions operate on explicit IDs or a frozen filter snapshot with confirmed count. Ignore persists across identical resyncs. Changed items create a revision with a field diff; accepted catalog versions stay live until new approval. Missing feed rows create review flags. |
| FR-ING-003 | Resolve wholesale from a confirmed SKU override, then category rule, then source default. Normalize currency and VAT basis before multiplication. Round once to agorot. Show source price, basis, rule, computed cost and override reason per variant. Unverified tax basis, missing sell unit or unsigned supplier pricing blocks publication. Public stock is descriptive; checkout uses the FR-INV inventory authority. |
| FR-ING-004 | Queue he and en titles, feature bullets, descriptions, SEO title/description, canonical category and bilingual attribute labels. Use RTL display for Hebrew and LTR for English. Preserve manufacturer identity, warnings, units, printed text and pack count. Remove supplier contact and promotional URLs from display copy. Keep source evidence per factual claim. Mark absent values unknown; require evidence for manual corrections. Missing optional facts may be omitted. Block publication for missing required attributes. |
| FR-ING-005 | Archive highest-resolution authorized raw asset. Create a 2000 × 2000 white or transparent studio composition and two or three lifestyle candidates. Preserve the source product foreground using compositing; generate scene backgrounds separately. Flag OCR changes, hue drift, altered shape, duplicated units and misleading accessories for human review. Detect watermarks and logos; require removal rights or a clean licensed original before editing them. Preserve physical product branding. Admin compares each candidate with raw, approves, rejects, regenerates via prompt, sets order and chooses exactly one approved primary. |
| FR-ING-006 | Require catalog-curator scope for enrichment and publisher scope for promotion. Keep reviewer, rights evidence, approval time, model/version, source hash, prompt and generation cost. Enforce batch and spend limits. Treat imported HTML and text as untrusted content. Sanitize preview and isolate generation workers from credentials. Retry failed text or image stages independently without rebilling completed generations. |
| FR-ING-007 | Publish against an expected revision. Validate both locales, source-linked variant identity, currency, sell units, asset rights and primary image. Atomically upsert product, variants, supplier offers, approved asset order and publication audit; emit catalog update after commit. Repeat with same key returns original result. Stale edit returns 409 with latest revision. Preserve seller listings, live price locks and existing supplier offer identity. |

#### Persistence contract · PostgreSQL

The following schema extends existing supplier, product, offer and audit entities. Keys and constraints listed here are normative. All IDs are UUIDs, times are TIMESTAMPTZ and prices use integer minor units. Store large raw HTML and image bytes in private object storage.

| Table | Keys and principal columns | Constraints and behavior |
|---|---|---|
| catalog_sources | id PK, supplier_id FK, connector_type, source_url, allowed_paths JSONB, credential_ref, currency, tax_basis, default_multiplier NUMERIC(6,4), rights_ref | Unique supplier and canonical source URL. Multiplier greater than zero and at most one. |
| catalog_import_jobs | id PK, source_id FK, requested_by, filters JSONB, status, cursor, discovered, staged, failed, started_at, finished_at | Job states queued, crawling, ready_for_review, partial, failed. Count unique discovered source products; keep row-level errors. |
| staged_import_items | id PK, source_id FK, external_product_id, live_product_id FK nullable | Unique (source_id, external_product_id). Supplier derived from source. Index live mapping. |
| staged_item_revisions | id PK, item_id FK, job_id FK, source_hash, raw_data JSONB, source_url, state, revision INT, updated_at | Unique (item_id, revision). Index (job_id, state). Immutable source evidence; version review edits optimistically. |
| import_job_items | job_id FK, item_id FK, revision_id FK, outcome | PK (job_id, item_id). Relate repeated unchanged imports to existing revision without duplicating generation. |
| staged_variants | id PK, revision_id FK, external_variant_id, supplier_sku, pack_size, currency, raw_price, tax_basis, wholesale, msrp, override_reason, evidence JSONB | Unique variant per revision. Require positive pack and nonnegative validated monetary amounts at publish. |
| catalog_cost_rules | id PK, source_id FK, category_id, multiplier, effective_from, effective_to | Prevent overlapping effective intervals per category and source. Snapshot applied rule per variant. |
| staged_localizations | revision_id FK, locale, title, bullets JSONB, description, seo JSONB, canonical_category_id, attributes JSONB, evidence JSONB | PK (revision_id, locale), locale in he/en. Preserve unknown values and manual verification. |
| staged_product_assets | id PK, revision_id FK, source_asset_id self FK, type, object_key, checksum, dimensions, prompt, model_version, rights_ref, approval, sort_order, is_primary | Types scraped_raw, ai_clean_cutout, ai_lifestyle. Partial unique index on revision_id where is_primary. Require approved primary at publish. |
| enrichment_tasks | id PK, revision_id FK, step, inputs_hash, state, attempts, provider_ref, error, estimated_cost, actual_cost | Unique (revision_id, step, inputs_hash). New regeneration request includes nonce; recover uncertain provider responses before retry. |
| catalog_publications | id PK, revision_id FK unique, product_id FK, actor_id, approved_snapshot JSONB, request_key unique, created_at | Immutable audit; link approved asset bytes durably before staging cleanup. Live products expose title_he/en, description_he/en, localized bullets, SEO and metadata. |

#### REST contracts

All routes below use the admin catalog namespace shown. Enforce tenant/supplier scope and require an idempotency key on job creation, enrichment, regeneration and publication. Responses use 403 for permission, 409 for stale or conflicting requests and 422 with field-level blockers for invalid inputs.

| Method and route | Input | Result |
|---|---|---|
| POST /admin/catalog-imports | supplier_id, source_url, connector_type, category_filter_paths, default_wholesale_multiplier; configured source credentials and tax basis | 202 with import_job_id, status and poll URL. |
| GET /admin/catalog-imports/{id} | Job ID | Status, progress, counts, cursor and row error summaries. |
| GET /admin/catalog-imports/{id}/items | q, status, category, stock, min/max price, cursor | Stable page of source rows with raw thumbnail, site price, proposed wholesale, source basis and revision. |
| POST /admin/catalog-imports/{id}/enrich | staged_item_ids, expected revisions, ai_options including languages, studio cutout, lifestyle count and preset | 202 with per-item task IDs and accepted/rejected counts. Validate membership and permissions before enqueue. |
| POST /admin/catalog-imports/{id}/ignore | staged_item_ids, expected revisions, reason | Updated states and per-item conflicts. |
| GET /admin/staged-items/{id} | Item ID | Current revision, raw evidence, variant costs, both locales, assets and publish blockers. |
| PATCH /admin/staged-items/{id} | Expected revision, locale/metadata edits, SKU overrides, approval decisions, primary and ordered asset IDs | Updated revision and validation results. Reject assets from another item or revision. |
| POST /admin/staged-items/{id}/assets/regenerate | Source asset ID, expected revision, approved preset or prompt, count | 202 with task reference; existing approved assets remain usable. |
| POST /admin/staged-items/{id}/publish | Expected revision, he/en copy, proposed price per variant, ordered approved_asset_ids and primary ID | 201 with live product, variant and offer IDs and published revision. Single-SKU requests may use wholesale_price_agorot and msrp_agorot. Replays return original mapping. |

**State transitions.** Discovery → Unreviewed → Enriching → Ready for review → Ready to publish → Published. Ignore removes an unreviewed or reviewable item from the queue. Partial generation failure → Needs attention → retry failed step. Edits to approved content reopen review. Ready for review indicates completed generation; human approval controls publication.

**AT-13** Import the same supplier SKU twice with identical evidence. Verify two run records, one source identity, no duplicate generation and no live item before approval. Change source price and verify a new revision with a visible diff.

**AT-14** Import a balloon with no helium compatibility data and a licensed reference image. Generate both languages and two scenes. Verify no helium claim, unchanged printed numeral, one approved primary and rejection of a candidate showing extra units. Publication fails on missing rights or unverified cost.

**AT-15** Concurrent publishers submit different revisions. Verify exactly one approved live mapping, one outbox event, a stale-version conflict, and unchanged captured order costs. Retail-site stock alone cannot enable checkout.

## 4. Core flows and state transitions

### Order lifecycle from checkout to payout

The retail order owns the consumer promise. Fulfillment state belongs to each FO line and parcel. Payment state belongs to the charge. Release and payout state belong to each beneficiary balance. A delivered parcel can have an open return while a different parcel from the same order is still in transit.

| Step | Entity and transition | Trigger and guard | Durable result | Requirement |
|---|---|---|---|---|
| 1 | Cart → Quoted / held | Buyer confirms destination and service. All lines eligible. | Quote, shipment groups, expiry and source-specific unit holds | FR-WEB-004, FR-INV-006 |
| 2 | Payment initiated → Authorized | Verified PSP authorization matches seller context, currency and amount | Provider reference and authorization deadline | FR-ORD-002 |
| 3 | Held → Committed / capture pending | Quote and hold still valid under lock | Parent order, FO lines and inventory movements in one local transaction | FR-ORD-002 |
| 4 | Authorized → Captured | Backend confirms capture for the exact amount | Capture journal and release events. Uncertain outcome remains pending reconciliation. | FR-ORD-002, FR-FIN-006 |
| 5 | FO released → Accepted → Picking | Warehouse acknowledges unique FO and claims task | Timestamped acknowledgment, SLA clock and scan history | FR-ORD-003, FR-ORD-004 |
| 6 | Picking → Packed → Shipped | Required SKU and packaging scans complete, physical handoff recorded | Parcel-to-line map, actual shipped units, consumer tracking | FR-ORD-005, FR-ORD-007 |
| 7 | Shipped → Delivered or Delivery exception | Valid carrier evidence for this parcel | Delivered quantities and eligibility clock, or recovery case | FR-ORD-007, FR-FIN-008 |
| 8 | Payable pending → Eligible → Transfer pending | Per-line hold elapsed, available PSP funds, positive balance, no blocking case | Batch entry and stable transfer key per beneficiary | FR-FIN-008 |
| 9 | Transferred → Bank paid or Payout failed | Provider confirms bank outcome | Statement with transfer/payout mapping, or reconcilable open payable | FR-FIN-008, FR-FIN-010 |
| 10 | Delivered → Return requested → Approved / rejected → Received → Inspected | Eligibility, RMA and warehouse evidence | Unit disposition, refund decision or appeal | FR-RET-001–003, FR-RET-007 |
| 11 | Refund pending → Refunded; beneficiary recovery pending → Recovered / receivable | PSP acknowledges consumer refund; recovery tracked separately | Consumer credit and distinct beneficiary reversal/receivable | FR-RET-004, FR-RET-005 |

**FR-ORD-010** Derive customer status from unit counts. All cancelled yields Cancelled. With live units, show Processing until first dispatch, Partially shipped while any live unit awaits dispatch, and Shipped once all live units have dispatched. Show Partially delivered after the first delivery when others remain open, and Delivered when all live units are delivered. Display cancelled quantities, exceptions, returns and refunds alongside that status. Partial delivery takes display precedence over partial shipment. Neither returns nor bank payouts erase delivery history.

### Inventory movements and invariants

“Allocated” denotes exclusive physical placement for a seller. “Reserved” denotes a temporary claim. A campaign can be converted to a dedicated lot by agreement. Ordinary Social and Branded sales can ship from shared bins. The table uses whole sell units throughout.

| From | To | Trigger and validation | Effect on availability / release | Requirement |
|---|---|---|---|---|
| Available | Reserved · campaign | Eligible seller reserves quantity and supplies expiry | Shared sellable falls. Only matching campaign may consume. | FR-INV-004 |
| Reserved · campaign | Reserved · physical move | Seller and supplier approve conversion before expiry and sign Scale terms | Freeze those units during transfer. No second reservation. | FR-INV-005, FR-INV-009 |
| Available | Reserved · physical move → Allocated | Dedicated request, then destination scan | Move shared units into beneficiary-only bin. | FR-INV-005 |
| Reserved · physical move | Allocated | Verified SKU, lot, count and destination | Dedicated free increases. A scan discrepancy blocks release. | FR-INV-005 |
| Available / Reserved · campaign / Allocated | Reserved · checkout | Cart acquires hold against an eligible pool | Track exact origin and expiry per segment. | FR-INV-002, FR-INV-006 |
| Reserved · checkout | Committed | Valid authorization and live hold under lock | Bind unit to FO line. Physical on-hand remains constant. | FR-ORD-002 |
| Reserved | Origin pool | Campaign/checkout expires or move is verifiably aborted | Release once. A pending physical move requires confirmed bin location. | FR-INV-007, FR-INV-009 |
| Committed | Origin pool | Capture definitely fails or unshipped cancellation confirmed | Restore eligible free stock after warehouse control is established. | FR-ORD-002, FR-ORD-009 |
| Committed | Shipped | Confirmed handoff for specified parcel units | Decrease commitments and on-hand together. | FR-ORD-007 |
| Shipped | Quarantine → Available / Allocated / write-off | Physical return and inspection | Restore only sellable quantity to rightful pool. | FR-RET-002, FR-RET-003 |

**FR-INV-009** Include pending physical moves as a distinct on-hand bucket in the FR-INV-001 sum. Move units from one origin bucket only. On expiry during a physical transfer, raise an exception and await a scan before release. Permit transfer from an existing campaign reservation only for its beneficiary with an active Scale agreement. Each movement must conserve source and destination quantities except documented external receipt, dispatch or write-off.

## 5. Edge cases and business rules

| ID | Condition | Required decision and observable outcome |
|---|---|---|
| FR-EXC-001 | Social post goes viral and many buyers request the last pack | Serialize hold acquisition. The winner receives a quote and expiry. Others receive 409 STOCK_CHANGED with remaining quantity and a cart edit action. Mark listing sold out when fresh sellable quantity reaches zero. Resume after verified replenishment. Cached pages cannot authorize a sale. |
| FR-EXC-002 | Supplier reports physical shrink below claims | Stop new holds for the SKU/pool and recalculate unclaimed headroom. Protect committed orders first, then live checkout holds, then campaigns by creation time within the same entitlement pool. Flag any uncovered customer commitment for named ops review, notify affected seller and offer cancellation/refund by deadline. Pool owner must approve any transfer across ownership boundaries. |
| FR-EXC-003 | Branded seller schedules downgrade while a campaign is active | Immediately prevent extensions beyond paid-through time. At boundary, close reservations and return unused stock. Honor active ten-minute checkout holds on existing quotes unless compliance suspension applies. Retire storefront and domain routing on effective downgrade to Social, retain platform order-status links, and notify seller of social links still eligible. |
| FR-EXC-004 | Scale seller downgrades with dedicated units or unconsumed inserts | End new premium commitments at boundary and put residual lots into run-off. Require written disposition with deadline, count, owner, fees and return destination or buyback terms. Fulfill existing orders under their original terms. New shared sales may use the lower plan. Release supplier-owned goods only after contractual authorization and warehouse scan. Seller-owned goods require return, authorized transfer or signed buyback. Overdue cases escalate to ops; residual handling fees require agreed terms. |
| FR-EXC-005 | One FO ships three of five units, or a second supplier rejects its FO | Record three shipped and two outstanding. Offer a dated backorder only with explicit customer acceptance by the configured response deadline. On rejection or timeout cancel missing units, refund their original apportioned amounts and unperformed shipping under policy. Preserve delivered lines, recalculate eligible payouts per line, and send one revised summary with parcel breakdown. |
| FR-EXC-006 | Supplier changes cost for an already listed item | Fixed retail remains fixed. Auto-markup listings recompute on cost effective time. Recheck proceeds and pause unprofitable listings pending seller action. Notify seller with old/new cost, retail, proceeds and affected listings. Honor valid locked quotes through expiry against the supplier's agreed price-lock terms. Require re-quote and consent after expiry. Captured orders retain their price snapshots. |
| FR-EXC-007 | Buyer loses connection during payment or double-submits | Return the prior order for identical idempotency key and payload. Return 409 for changed payload. Present pending status until PSP resolution. Never release paid work twice or prompt a second payment while the first result is unknown. |
| FR-EXC-008 | Packaging stock is short or parcel goes missing after dispatch | For packaging, block pack or apply contractual fallback with charge correction. For loss, open carrier claim, track consumer remedy separately, and hold disputed settlement. Any replacement needs its own stock commitment, zero duplicate retail charge and linkage to original line. |

## 6. Non-functional requirements and integrations

### Service targets and verification

Pilot targets apply to a domestic region. Measure monthly availability by successful eligible requests divided by all eligible requests, including dependencies. Exclude invalid requests and expected business rejections. Track PSP challenge time separately from Storey's server latency.

| ID | Target | Verification / operational action |
|---|---|---|
| NFR-PER-001 | Sustain 2,000 catalog/link reads/s and 100 checkout starts/s for 15 minutes; burst to 5,000 reads/s and 250 starts/s for 60 seconds, 80% targeting one campaign. | Load test with 10,000 active SKUs. Public read p95 ≤250 ms at edge, checkout hold p95 ≤800 ms and p99 ≤2 s at origin, excluding PSP interaction. Technical error rate <0.5%. Assert zero oversells, duplicate captures or unbalanced journals. |
| NFR-PER-002 | Core checkout availability ≥99.9% monthly. Under overload protect payment callbacks, stock releases and order lookup before analytics or page previews. | Cache public media and listing pages, bound hold creation per tenant/session, apply 429 with Retry-After, queue optional work. Test cold-cache and hot-SKU traffic. |
| NFR-OPS-001 | Reflect 95% of valid WMS inventory changes in authoritative checkout within five seconds of receipt and 99% within 30 seconds. | Track source age, processing lag and sequence gaps separately. Alert ops on a five-minute stale heartbeat, queue backlog over 60 seconds for five minutes, capture uncertainty over five minutes, or any ledger imbalance. |
| NFR-OPS-002 | Restore core order service within 60 minutes of regional failure. Target backup RPO ≤5 minutes. | Test restore quarterly. Replay journals, outbox, PSP and warehouse events from durable checkpoints. Keep checkout and payouts closed until financial and inventory gaps are reconciled. |
| NFR-SEC-001 | Require TLS 1.2+ in transit, encryption at rest, scoped service credentials, managed secrets, MFA for staff and payout changes, and tenant isolation in queries, caches and object storage. | Test cross-tenant ID access, export authorization, domain ownership and session revocation in CI. Restrict beneficiary changes with step-up verification and dual control for overrides. |
| NFR-SEC-002 | Capture card data in provider-hosted payment UI. Store token, brand and masked reference only. Exclude card numbers, security codes, credentials and unredacted payloads from application logs. | Security owner and acquirer verify the actual payment integration's PCI obligations before launch. Enforce access-controlled evidence storage and documented retention by record class. |
| NFR-PRV-001 | Collect ship-to data only for fulfillment, support and approved recordkeeping. Separate marketing opt-in from purchase consent. | Support verified access/deletion requests, deletion across processors, and retention exceptions for disputes, tax documents and audit records. Configure deadlines and residency by launch market. Test guest and tenant export redaction. |
| NFR-UX-001 | Checkout, tracking, returns and seller publish flows meet WCAG 2.2 AA as the design target. | Test keyboard navigation, labels, focus, error recovery, screen-reader totals, 320 px viewport and localized price, date and address fields. Keep submission safe across refresh and mobile-network retries. |

### Integration contracts

| ID | Interface | Contract and failure handling |
|---|---|---|
| FR-API-001 | Supplier WMS inbound | Versioned HTTPS API accepts catalog batches, stock snapshots, movement confirmations, FO acknowledgments and shipment events. Require scoped machine credential, schema version, unique event ID, source, tenant, occurrence time, aggregate ID and sequence. Validate schema and authorization before durable enqueue. Return 202 plus receipt ID; expose receipt status as Applied, Duplicate or Rejected with reason. |
| FR-API-002 | Outbound events | Publish order.released, order.cancel_requested, inventory.move_requested and return.authorized from a transactional outbox. Deliver at least once. Sign timestamp and raw body using a rotating per-endpoint secret. Consumers deduplicate event IDs. Retry on timeout, 429 or 5xx with jittered backoff capped at one hour for 24 hours. Then dead-letter, alert and permit audited replay with the same event ID. |
| FR-API-003 | Event consistency | Reject invalid signatures and timestamps outside ±5 minutes; re-sign retries with a fresh delivery timestamp. Persist event dedupe keys at least 90 days and permanent business keys for money and stock postings. Require monotonic aggregate versions. A gap triggers authenticated snapshot recovery. Record corrections as new events. |
| FR-API-004 | PSP | Require marketplace beneficiary onboarding, hosted authentication, authorization/capture, partial refunds, adjustable transfers, balance reporting, dispute evidence and payout webhooks for the selected launch market. Validate signature, amount, currency and beneficiary references. Treat unknown responses as pending. Provider polling must recover missed callbacks. |
| FR-API-005 | Carrier, tax and communications | Carrier adapter supports service quotes, labels, voids, manifests and tracking. Tax adapter returns component, basis, rate, jurisdiction, remitter and version. Block checkout when required quotes cannot be verified. Queue receipts, tracking and RMA notifications by business event and recipient, retry transient delivery failure and surface permanent failure to support. |
| FR-API-006 | Operator observability | Propagate correlation IDs from link/quote to order, hold, FO, shipment, journal, PSP transfer and RMA. Provide searchable tenant-scoped timeline and alert runbooks for shortage, stalled capture, missing acknowledgment and failed payout. Limit raw event evidence to authorized operators. |

**Representative payload.** For an inbound physical snapshot, the outer event ID identifies delivery retries; the source sequence orders snapshots; the movement watermark identifies the local movements already reflected in the reported count.

```json
{
  "schema_version": "1.0",
  "event_id": "evt_204",
  "type": "inventory.snapshot",
  "source": "warehouse-adapter-1",
  "tenant_id": "supplier_01",
  "aggregate_id": "wh_01:DECOR-BLUE-10:shared",
  "sequence": 204,
  "occurred_at": "2026-11-22T08:00:00Z",
  "data": {
    "warehouse_id": "wh_01",
    "supplier_sku": "DECOR-BLUE-10",
    "pool_id": "shared",
    "on_hand_sell_units": 48,
    "movement_watermark": 198
  }
}
```

**FR-API-007** Map an authenticated integration to its supplier and allowed warehouses before accepting tenant IDs. Support cursor-paginated snapshot recovery, per-item validation details, 400 malformed schema, 403 scope failure, 409 sequence or idempotency conflict and 429 rate limit. An asynchronously detected gap marks the receipt Rejected with recovery reason. Allow additive optional fields within a major version. Publish a new major version for breaking changes.

### Release acceptance scenarios

| Test | Fixture and action | Expected observable result | Coverage |
|---|---|---|---|
| AT-01 | One shared pack, buffer zero, 100 concurrent shoppers, one duplicate submit | One live hold and at most one capture. In a separate run without payment, expiry restores one pack. Preview bots create zero holds. | FR-INV-006, FR-EXC-001, FR-EXC-007 |
| AT-02 | Ten shared packs. Reserve six for campaign A. Hold two from A, expire campaign, abandon checkout. | Unrelated shoppers initially see four. At campaign expiry shared free becomes eight; hold expiry restores ten. | FR-INV-002, FR-INV-004, FR-INV-007 |
| AT-03 | Prepaid Scale lot contains five units. Sell two, then downgrade with three still on hand. | Supplier is paid merchandise cost once on lot purchase. Three units remain beneficiary-only until verified disposition. A returned sellable unit restores the same seller lot. | FR-FIN-007, FR-EXC-004, FR-RET-003 |
| AT-04 | One consumer buys from one seller sourcing two suppliers. First delivers; second rejects before dispatch. | One charge, two isolated FOs. Refund and fee reversals cover the rejected portion. First supplier can settle after its own hold. Neither supplier sees the other's lines. | FR-ORD-001, FR-EXC-005, FR-IAM-001 |
| AT-05 | Net base cost 60 rises to 70 during a ten-minute quote. Another shopper opens same listing after effective time. | First valid hold captures using 60. New quote uses 70. Fixed retail stays fixed if profitable. An expired quote requires renewed consent. | FR-EXC-006, FR-WEB-005 |
| AT-06 | Delivered zero-tax example from §3C is fully refunded after payout. Assume full beneficiary reversals including freight; PSP fee is nonrefundable. | Customer receives 110 once. Recover 70 supplier, 35 seller and reverse 5 platform fee. The 2 processing expense remains. Failed recovery creates a receivable. | FR-FIN-006, FR-RET-004, FR-RET-005 |
| AT-07 | Inject lost capture response, repeat capture webhook, late carrier scan and out-of-order WMS snapshot. | One release, one journal, no duplicate shipment or state regression. Inventory gap blocks the affected SKU until reconciled. | FR-ORD-002, FR-ORD-007, FR-API-003 |
| AT-08 | Social seller calls dedicated-stock API directly. Different seller attempts to claim its active domain. | Both writes rejected. Domain reassignment requires release and fresh ownership proof. Cross-tenant reads reveal no order content. | FR-SUB-003, FR-WEB-003, FR-IAM-001 |
| AT-09 | Capture spans a GMV threshold, then a refund lowers trailing GMV. Exercise quantity-tier boundary and a competing contract price. | Existing quote retains its cost. Subsequent quotes after refresh use the applicable inclusive band. Lowest eligible cost applies once. | FR-FIN-002 |
| AT-10 | Tax-inclusive fixture with configured 20% retail and wholesale test rates, retail 120, wholesale 72 gross, no shipping or fees, seller remits retail tax. | Customer pays 120. Supplier payable 72 includes 12 wholesale tax; seller payable 48 includes the retail transaction's 20 tax liability in its breakdown. Each invoice identifies its issuer. Capture journal balances to 120. | FR-FIN-006, FR-FIN-009 |
| AT-11 | Mandatory insert short on packing scan; duplicate label request after carrier timeout. | Packing blocks pending resolution. A recovered label retains the original tracking ID. Inventory leaves only at confirmed handoff. | FR-ORD-005, FR-ORD-006, FR-ORD-007 |
| AT-12 | Seller refund and PSP dispute arrive concurrently against the same settled line. | One case links both events, remaining exposure is locked, recovery is capped and reconciliation flags any unresolved excess debit. | FR-RET-004, FR-RET-006 |

### Decisions required before live sales

| Owner | Decision to approve | Configuration or evidence required |
|---|---|---|
| Product and Finance | Subscription prices, take-rate, GMV thresholds, volume bands, packaging costs, seller floors and who absorbs refunds by reason | Signed rate cards, plan versions and effective dates. Test fixtures above supply no commercial rates. |
| Finance, legal and PSP | Merchant of record, issuer/remitter for each leg, funds flow, chargeback liability, refund funding and release timing | Approved domestic market and currency, executed PSP terms, tax and rounding rules, validated invoice samples and reconciled sandbox settlement. |
| Supplier Operations | Warehouse authority, exclusive pool or WMS feed, stock buffers, return grades, campaign limits, dedicated ownership and exit | Signed pilot SLA, count baseline, packaging BOMs, service zones, backorder response window, disposition and funding terms. |
| Support, privacy and security | Consumer cancellation and return windows, exceptions, escalation deadlines, privacy retention and access | Approved market policies, versioned customer disclosures, acquirer review, restore exercise and successful role-isolation tests. |
| Engineering and Product | Launch acceptance | Pass AT-01 through AT-12 and service targets. Rehearse partial shipment, compensation and two-supplier routing with simulated second supplier. Record exceptions, accountable owner and disposition before release. |
