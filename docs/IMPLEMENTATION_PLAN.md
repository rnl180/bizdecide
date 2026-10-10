# BizDecide implementation plan: items 1–16, 20, 22

Written 10 Oct 2026 for whoever builds it. Scope agreed with Ahmad: items **1–16, 20 and 22** from the change list in [research/product_wow_strategy.md](../research/product_wow_strategy.md) (section 3.1 and the list in the chat), plus the **conversational intake** that extends item 22. Product name stays **BizDecide**. Not in scope: hutang radar (17), rename (18), scenario sliders beyond the "Senario" copy in 22 (19), SkillHub listing (21).

Every file path, function name and line number below was read from the repo on 10 Oct 2026 (uncommitted working tree, which already contains the Claude engine) and re-checked by an independent read-only review. The tree is still moving (another session added `app/tokens.css` and dark-mode tokens during the review), so re-read a file before editing it. Line numbers drift; search by name. The item numbers follow the change list agreed in chat; the table in section 1 is the canonical scope.

---

## 0. Ground rules

1. **Additive schemas only.** Every new field on `Result`, `Decision`, `ApplicationPack`, `ProgressEntry` is `.optional()`. Old stored results must still parse: `getResult` (`lib/store.ts` ~L235) returns stored docs without re-validation, and the brief page reads `result.verification.length`, `result.assumptions`, `result.agentsUsed` without optional chaining (`app/r/[id]/page.tsx` ~L433, ~L650, ~L667). New arrays must be read with `?? []`.
2. **Declare or lose.** `ResultSchema` is a plain `z.object` (zod 4 strips unknown keys). A field that is not declared vanishes at `parseStructured` (`lib/claude-cfo.ts` ~L273-295) and at the MCP `submit_results` tool (`app/api/mcp/route.ts` ~L355). Every new result field must be added to `lib/types.ts`, described in `VERIFIER_PROMPT` (`lib/claude-prompts.ts` ~L41-62), and mentioned in `workbuddy/bizdecide_instructions.md` (~L93-109) so the WorkBuddy path keeps working.
3. **Two languages, always.** `ms` tables are typed as the `en` shape (`lib/i18n-app.ts`, `lib/i18n-actions.ts`, `lib/i18n-quick.ts`, `lib/i18n-landing.ts`, `lib/i18n.ts`), so `npm run typecheck` fails until both have the key. Follow the existing naming (camelCase, `q*`/`ask*`/`pack*` prefixes, arrow functions for interpolation, `Record<Enum, string>` maps).
4. **Both engines keep working.** With `ANTHROPIC_API_KEY` set, `POST /api/requests` runs `processRequest` in `after()` (`app/api/requests/route.ts` ~L30). Without it, WorkBuddy claims the request through `/api/mcp`. New progress fields must be accepted by the MCP `update_request` schema (`app/api/mcp/route.ts` ~L201-207) or WorkBuddy's calls will be stripped.
5. **The demo data is the source of truth.** `public/demo/*` is built from `demo/kedai-kopi-aminah/` by `node scripts/build-demo-from-pack.mjs`. **Do not run `npm run demo:data`** (`scripts/generate-demo-data.mjs` is the old generator with different columns and would overwrite the files). The planted findings are in `docs/ANSWER_KEY.md`; the scorer is `node scripts/score-result.mjs`.
6. **Wording.** Never "financial adviser / penasihat kewangan", "financial planner / perancang kewangan", "AI accountant / akauntan AI", "licensed", "approved by BNM/SC", or "approved" in the funding ladder. "AI CFO" is fine. Add the disclaimer "Bukan nasihat pelaburan atau insurans berlesen / Not licensed investment or insurance advice" to the brief footer and the chat.
7. **Checks before every handoff:** `npm run typecheck`, `npm run build`, a local run against the demo café with `BIZDECIDE_STORE=local`, `ANTHROPIC_API_KEY` set and `python3` on PATH, then `node scripts/score-result.mjs`. There is no lint or test runner in the repo.

---

## 1. Scope, phases and effort

Effort is developer-days for one person using Claude Code. Phase 0 is shared plumbing; do it first.

| Phase | # | Item | Days |
|---|---|---|---|
| 0 | F1 | Schema additions (confidence, evidence source + formula, verification status, lane progress, pack ladder/shariah, decision log, morning note) | 0.5 |
| 0 | F2 | Lane events from the engine and the MCP tool | 0.5 |
| 0 | F3 | Source-row route and keyed evidence from the scripts | 0.5 |
| 0 | F4 | Engine hygiene: re-run stuck requests, stop double script execution, cache lane outputs for chat | 0.5 |
| 0 | F5 | Demo pack additions (declared sales, Muslim ownership %, closed days) and rebuild | 0.5 |
| 1 | 22b | Conversational intake (chat with attachments replaces the form; form stays at `/start`) | 2 |
| 1 | 22 | Chat-first brief: two-pane layout, quick actions, artifact panel with formulas, Utama/Senario | 2 |
| 1 | 2 | Six agent lanes with step streams and a rolling RM counter | 1 |
| 1 | 1 | Evidence chips that open the source rows | 1 |
| 1 | 3 | Named Verifier lane, planted error, worded confidence, checked / could not check | 1 |
| 1 | 4 | Audience QR poll on the owner question | 1 |
| 1 | 5 | Found-money ledger with footnote and hours saved | 0.5 |
| 1 | 6 | Funding ladder, TEKUN checklist, Shariah toggle, Budget 2027 line | 1.5 |
| 1 | 7 | Price Movers decision card with sparkline and SST note | 1 |
| 1 | 8 | Classifier guardrails | 0.5 |
| 1 | 9 | Deterministic seed, cached replay, recording | 0.5 |
| 1 | 10 | Kak Kira voice and copy (BizDecide stays the brand) | 0.5 |
| 2 | 11 | Decision log and audit tab | 1 |
| 2 | 13 | e-Invoice status card | 0.5 |
| 2 | 12 | Zakat perniagaan tile | 0.5 |
| 2 | 14 | Payments and channel margin ledger | 1 |
| 2 | 15 | Morning note and "did it work?" loop | 1.5 |
| 2 | 16 | Share-with-accountant link and succession pack | 1.5 |
| 2 | 20 | Peer benchmark line from a labelled synthetic cohort | 1 |

Phase 0 + 1 ≈ 15 days. Phase 2 ≈ 7 days. Two people in parallel (one on engine and scripts, one on the two React surfaces) brings Phase 0 + 1 to about eight working days.

---

## 2. What you are building on (read before coding)

**Engine** (`lib/claude-cfo.ts`, about 660 lines; prompts in `lib/claude-prompts.ts`)
- `processRequest(requestId)` (~L386-504) guarded by `once()` (~L60) and `claimRequest()` (`lib/store.ts` ~L182, accepts only `submitted`). Model `claude-opus-5-5`, effort `high`, beta `server-side-fallback-2026-07-01`, `fallbacks: "default"`, adaptive thinking, streaming via `converse()` (~L219-256).
- Five lane tools (`LANES` ~L119-180): `run_bookkeeper`, `run_reconciliation`, `run_procurement`, `run_classifier`, `run_funding`; plus `ask_owner`. Lanes run the Python scripts through `python()` (~L78-90, `execFile`, 60 s timeout) inside `openWorkspace()` (~L96-109, temp dir with `data.json`, memoised per script). `runTools` (~L408-438) runs all tool calls of one turn in `Promise.all`; skipped lanes are run after the draft (~L459-461). `run_all.py` re-executes the three scripts itself (`workbuddy/run_all.py` ~L40-48), so each script runs twice per request today.
- Progress: `updateRequest(id, {status?, progress?, error?})` (`lib/store.ts` ~L194-204) appends `{at, step, detail?}`; emission points ~L412, L421, L436, L464, L491, L495 and `askOwner` ~L338/345/351. Lane failures write nothing.
- Questions: `askOwner` (~L334-354), `MAX_QUESTIONS = 2`, `ASK_WAIT_MS = 120_000`, polls `getQuestion` every 2 s, expires with the default. Owner answers via `POST /api/questions/[id]/answer` `{answer, otherText?}`; one answer closes the question (409 afterwards).
- Verifier: a second `converse` with no tools (~L465-486), system `[VERIFIER_PROMPT, marketKnowledge]`, structured output `zodOutputFormat(ResultSchema)` (~L377), then `clampResult` and `ResultSchema.safeParse` with one corrective turn. `agentsUsed` set server-side (~L488). `saveResult` (`store.ts` ~L231) does a full `set` on doc id = request id.
- Chat: `POST /api/requests/[id]/messages` (completed only, 3 waiting / 30 total) → `answerOwnerMessage` (~L515-563) re-runs all five lanes per message, `ReplySchema {answer ≤2000, evidence ≤5}` (~L508).
- Actions: `DecisionAction` (`components/DecisionAction.tsx`) POSTs `{decisionIndex, lang}` to `/api/requests/[id]/actions`; `processAction` (~L597-657) returns `{summary, email?, document?}`; channel is `note` or `document` on the Claude path (Gmail drafts exist only on the WorkBuddy path).

**Brief page** (`app/r/[id]/page.tsx`, 969 lines, client component)
- Polls `GET /api/requests/[id]` every 2.5 s → `{request, question, result, messages}`; no SSE.
- In-progress view: `.layout-2` (left column + 320 px `aside`), `NowCard` status banner (~L213), `QuestionCard` (~L295-375), live-activity timeline (~L150-174), static `TEAM` card (~L50-57, lists Delivery; the engine's lanes are Bookkeeper, Reconciliation, Procurement, Classifier, Funding, Verifier). Use the engine's list and add Reconciliation to `TEAM` and to `t.team` in `lib/i18n-app.ts` (~L37-44, ms ~L184-191).
- `Brief` (~L427-697): single column (`article.container.container-narrow`), `brief-hero` with `FoundHeadline` (impact banner, `components/DecisionAction.tsx` ~L585-639), key numbers, decision cards (~L533-626) with `aside.evidence` (~L578-602; items `{label, detail?, url?}`), `DecisionAction` per card, `ApplicationPacks` (~L716-830), `AskCfo` (~L834-947; suggested chips only when the thread is empty), verification card (~L634-656, score at ~L433), assumptions, prepared-by.
- CSS: `app/globals.css` (`.layout-2` ~L297, `.timeline`, `.team`, `.chip`, `.chip-toggle[data-on]`), `app/actions.css` (`ax-` prefix), `app/quick.css` (`qx-`, sticky `.qx-side` ~L80), `app/landing.css` (`lx-`). New CSS goes in a new prefixed file imported in `app/layout.tsx` (~L2-5). Breakpoints 900 / 760 / 640 px. Light and dark themes via `app/tokens.css` (added in the working tree while this plan was written); test both. Print via `window.print()` and `.no-print`.

**Contract** (`lib/types.ts`): `DecisionSchema` (~L130-141), `ResultSchema` (~L144-160), `ApplicationPackSchema` (~L164-188, declared after Result, hence `z.lazy`), `ProgressEntry` (~L94-98), `RequestDoc` (~L100-112), `QuestionDoc` (~L114-127), `ChatMessageDoc` (~L192), `ActionDoc` (~L224-242). Input schemas are `.loose()` except `BankTxSchema`. Channel columns on sales rows survive as `cashRm`, `duitnowQrRm`, `cardRm`, `deliveryGrossRm` (re-attached by `withSalesSplit` in `lib/intake.ts` ~L72-104).

**Store** (`lib/store.ts`): `Collection` union (~L28) mirrored in `loadDb` (~L49) and `col` (`lib/firebase.ts` ~L46-53); a new collection needs all three. Local JSON at `.data/db.json` when `BIZDECIDE_STORE=local`; Firestore otherwise (the local `.env` sets `FIREBASE_PROJECT_ID`, which forces Firestore unless you set `BIZDECIDE_STORE=local`).

**Scripts** (Python 3, stdlib only, `--data <path>`): `workbuddy/skills/financial-analyzer/scripts/analyze.py` (duplicates = payable invoiceNo found in more than one bank debit; QR/card settlement matching; `channelTotals12m`; `normal_do_not_flag` incl. cash-on-delivery invoices), `supplier-price-tracker/scripts/track.py` (alerts when last unit price vs first exceeds 5 %; `steps[]` of changes; `evidenceInvoices`; no full series), `sme-classifier/scripts/classify.py` (hard-coded `RULES`, `next.salesHeadroom` already in RM, `declaredVsActual` only when `annualSalesDeclaredRm` exists, `unknownForEligibility`). `workbuddy/run_all.py` pre-screens `funding_db.csv` with regexes (~L84-110), ranks candidates, whitelists price-creep `detail` keys (~L135). `funding-matcher` and `brief-writer` have no skill folder.

**Knowledge** (`workbuddy/knowledge/markets/MY/`): `funding_db.csv` (20 rows; columns `id, program, agency, type, min_rm, max_rm, rate, tenure, ownership, bumi_only, women_only, age_rule, min_operating, min_turnover, other_criteria, sectors, documents, deadline, deadline_date, status, how_to_apply, source_url, source_type, verify_flag, notes, checked`; no shariah column; `documents` is semicolon-separated), `funding_db.json` mirrors it (keep both in sync by hand; `run_all.py` reads the CSV), `sme_rules.json`, `sme_definition.md`, `glossary.md`, `programs/*.md`, `market.json` (`demo` = `/demo/kedai-kopi-aminah.json`).

**Demo data** (`public/demo/`, built from the pack): sales 308 open days Oct 2025–Sep 2026 (`note` = `Ramadan` on 24 rows; closed Mondays and six Raya days are dropped by the build script), purchases 79 lines / 26 invoices Jun–Sep 2026, suppliers S01–S06 (S03 bread and S06 LPG cash on delivery), bank Sep 2026 only (opening 18,450.00, closing 16,959.22), payables 26. Planted: kopi-powder creep `Serbuk Kopi O Campuran 1kg` 28.00 → 31.36 over 8 invoices (+12 %, about RM983/yr); duplicate `LSS/2609/278` RM642 paid 15 and 16 Sep; missing DuitNow QR settlement for 18 Sep RM312.40; Pasaraya Serba Murah receipt `R-0912-0047731` with an ambiguous RM39.90 rice line. Not anomalies: COD bread/LPG, owner drawing RM1,500, card settlements 1.5 % below gross, delivery payouts 70 %. The profile has no `annualSalesDeclaredRm`; actual 12-month sales are RM252,571.08. No receivables exist. Milk prices are flat.

**Build/env**: Next 15.5, React 19, `@anthropic-ai/sdk` 0.133, zod 4.6, Node ≥ 20 (Docker `node:22-alpine` with `python3`, no pip). Scripts: `dev` (port 3100), `build`, `start`, `typecheck`. Env: `ANTHROPIC_API_KEY`, `BIZDECIDE_MCP_KEY` (MCP auth is skipped when unset; also signs data links), `BIZDECIDE_STORE`, `FIREBASE_*`, `BIZDECIDE_PUBLIC_URL`, `PYTHON_BIN`, `PORT`. Whether Firebase App Hosting has `python3` is unverified; Docker does.

---

## 3. Decisions taken (so nobody re-litigates them)

1. **Demo story uses the real planted data.** Hero decision = kopi-powder price creep (not milk). Duplicate = `LSS/2609/278`. The ambiguous item for the live question = the Serba Murah RM39.90 rice line (business / personal / split). The eligibility question = monthly household income (needed by several micro schemes; the scorer already expects it). The research doc's placeholder figures (KB-2609, milk, Harvey Norman, RM280k/RM335k) are replaced by these.
2. **Confidence vocabulary:** `high | medium | check`, rendered as worded badges (Tinggi / Sederhana / Semak), set by the Verifier.
3. **Evidence references are keyed, not indexed:** `{table, keys[]}` where keys are `invoiceNo` (purchases, payables), `reference` (bank) or `period` (sales). The scripts already emit these keys; array indices are not stable across uploads.
4. **Lane attribution lives on `ProgressEntry`** (`lane`, `state`), not on `Result`. The brief page groups progress by lane.
5. **The audience poll is a tally beside the owner's answer,** stored in a new `votes` collection. The owner's (or presenter's) click on the existing answer route still closes the question. One venue NAT must not hit the answer rate limit, so votes get their own limit keyed by question + cookie.
6. **Six lanes on screen:** Bookkeeper, Reconciliation, Procurement, Classifier, Funding, Verifier. "Delivery" is dropped from `TEAM`.
7. **`MAX_QUESTIONS` becomes 3** (env `BIZDECIDE_MAX_QUESTIONS`, default 3) and `ASK_WAIT_MS` becomes env `BIZDECIDE_ASK_WAIT_MS` (default 120 000; keep 120 000 or raise it for the stage). Also change "at most 2 questions" in `ANALYSIS_PROMPT` (~L10) to read the configured limit.
8. **Budget 2027 and any tabled measure are "proposed"** and live in a separate knowledge file with status and date; prompts must label them "tabled 9 Oct 2026, not yet law".
9. **Group-ownership rule:** sole proprietorships and partnerships are independent by construction (`profileExtras.legalForm`); for a Sdn Bhd with unknown group ties the classifier returns `cannot_determine` for assistance eligibility and the engine asks.
10. **Per-item channel margin is impossible** (sales rows have no item lines); item 14 computes per-channel margin and fee savings only.
11. **No server-side scheduler or mail.** The morning note is generated at completion and surfaced in-app with a WhatsApp share link; the voice note uses the browser's speech synthesis for the demo only.

---

## 4. Phase 0: foundations

**Status, 10 Oct 2026: done** (not committed; typecheck clean for these files; smoke-tested with a scripted fake Claude client on the demo café, since no API key was available, so a real model run is still owed). Where the build differs from the spec below:
- `SourceRef` has an optional `item` (purchases only). An invoice has several lines, so the kopi chip passes `item: "Serbuk Kopi O Campuran 1kg"` and the rows route (`&item=`) returns the eight kopi lines, not all 24.
- Sales keys may be `YYYY-MM` months; the route opens every day of that month.
- Script field names: `analyze.py` puts `source` (bank refs) and `ledgerSource` (payables) on duplicates, `source` on missing settlements, unmatched payables and drawings, `receiptSource` on mixed receipts, `cashOnDeliverySource` under `normal_do_not_flag`. `track.py` adds `series`, `averageQtyPerOrder`, `ordersPerYear`, `formula` and `source`. `classify.py` uses `salesRows` (its `source` was already the SME Corp URL). `run_all.py` copies `source` onto each candidate.
- `analyze.py` also gives `closedDays` per month and reports a closure note that appears every month ("Closed (Monday)") once as `regularClosures`, so the month notes only carry Ramadan and Raya.
- The Verifier prompt does **not** yet ask for `status: "not_checked"`. The current brief page would count those as failed checks, so that belongs with item 3 (page score change plus the server-side `notChecked` list).
- Decision 7 is done here: `BIZDECIDE_MAX_QUESTIONS` (default 3) and `BIZDECIDE_ASK_WAIT_MS` (default 120 000). A run counts as stale after `max(5 min, ask wait + 1 min)`, and re-claiming expires the question it left open.
- `DecisionLogDoc` is declared in `lib/types.ts`; its collection is still item 11.
- Until item 2 lands, the brief page's timeline lists every lane step (about 35 lines on the demo instead of about 10).

### F1. Schema additions (`lib/types.ts`)

Add, all optional:

```ts
// ProgressEntry
lane?: "bookkeeper"|"reconciliation"|"procurement"|"classifier"|"funding"|"verifier";
state?: "started"|"step"|"waiting"|"done"|"failed";
impactRm?: number;          // a money finding reported mid-run, for the rolling counter

// evidence item (DecisionSchema.evidence[] and ChatMessageDoc.evidence[])
source?: { table: "sales"|"purchases"|"suppliers"|"bank"|"payables"; keys: string[] };
formula?: string;           // "extra/yr = (31.36 − 28.00) × 11.25 kg/order × 26 orders/yr ≈ RM983"
basis?: "data"|"assumption";

// DecisionSchema
confidence?: "high"|"medium"|"check";
confidenceNote?: string;

// ResultSchema
verification[].status?: "passed"|"failed"|"not_checked";   // keep `passed`
notChecked?: { item: string; reason: string }[];           // deterministic server-side list
impactBasis?: string;        // footnote under the found-money total
hoursSavedPerMonth?: number; hoursBasis?: string;
numbers?: { label: string; value: number; unit?: "RM"|"%"|"days"|"kg"|"count"; formula?: string; source?: {...}; basis?: "data"|"assumption"; editable?: boolean; variable?: string }[];  // the artifact numbers table (item 22)
morningNote?: { lines: string[]; lang: "en"|"ms" };       // item 15
followUps?: { decisionTitle: string; forecastRm?: number; observedRm?: number; verdict: "worked"|"partly"|"not_yet"|"unknown"; detail: string }[];  // item 15
einvoice?: { status: "exempt"|"required"|"cannot_determine"; thresholdRm: number; declaredRm?: number; bankImpliedRm?: number; headroomRm?: number; nextCheck: string; ruleVersion: string; sourceUrl: string };  // item 13
zakat?: { modalKerjaRm?: number; untungRugiRm?: number; nisabRm: number; muslimOwnershipPct?: number; method: string; sourceUrl: string; assumptions: string[] };  // item 12
channels?: { channel: "cash"|"qr"|"card"|"delivery"; grossRm: number; feesRm: number; feePct: number; netRm: number; basis: "data"|"assumption"; note?: string }[];  // item 14
benchmarks?: { label: string; yours: number; cohort: number; unit: string; cohortName: string; synthetic: true }[];  // item 20

// ApplicationPackSchema
ladder?: "matched"|"eligible"|"document_ready";
shariah?: boolean;
proposedNotes?: string[];    // "Budget 2027 (tabled 9 Oct 2026, not yet law): TEKUN allocation RM1.3bn"
```

Declare the small nested schemas above `ResultSchema` so no new `z.lazy` is needed. Describe each new field in `VERIFIER_PROMPT` (one bullet each, with the rule "copy `source.keys` from lane outputs; never invent keys") and in `bizdecide_instructions.md` ~L93-109. Add the new result fields to the MCP `submit_results` description. Update `docs/sample-result.fixture.json` with one example of each.

### F2. Lane events

- Extend the `Lane` interface (`claude-cfo.ts` ~L112-117) so `run(ws, fmt, emit)` receives `emit(step: string, extra?: {detail?, impactRm?})`. Each lane emits at least: started → "script finished (N rows)" → done, with the lane's summary as `detail`. In `runTools` (~L408-438) write `{lane, state: "started"}` before `lane.run`, `{lane, state: "done", detail: summary}` after, and `{lane, state: "failed", detail: error}` in the catch (today silent). The post-draft catch-up (~L459-461) and `runLanes` (~L182-185) use the same emitter.
- Reconciliation emits `impactRm` for the duplicate and the missing settlement (it already computes `cashToRecover`); Procurement emits `projectedExtraPerYear` for each alert. These feed the rolling counter.
- Verifier: write `{lane: "verifier", state: "started"}` at ~L464 and, after `parseStructured`, one `{lane: "verifier", state: "step"}` per `verification[]` item (step = check, detail = passed/failed), then `done`.
- MCP: add `lane`, `state`, `impactRm` to the `update_request` tool schema (`app/api/mcp/route.ts` ~L201-207) and pass them through to `updateRequest`.

### F3. Source rows

- Scripts: `analyze.py` already outputs `invoiceNo` and `bankLines[].reference` for duplicates (~L84-86) and `saleDate` for missing settlements (~L125); `track.py` outputs `evidenceInvoices` (~L59), but that is only the first and last invoice, and `steps[]` adds the three change invoices (five of eight). Add explicit `source: {table, keys}` objects next to each finding in all three scripts and in `run_all.py` candidates, with `track.py` listing every invoice of the series, so the model copies keys rather than composes them.
- New route `GET /api/requests/[id]/rows?table=purchases&keys=KCB-26-1187,KCB-26-1229` → resolves `request.businessId` → `getBusiness` (`store.ts` ~L157) → filters rows by key (`invoiceNo` / `reference` / `period`), caps at 200 rows, `cache-control: no-store`. The request id is already the public handle for the brief, so no extra signature; apply `rateLimit(req, "rows", 120, 600)` from `lib/guard.ts`.
- Prompts: in `VERIFIER_PROMPT` add "every evidence item that cites an invoice, bank line or sale date must carry `source` with the keys exactly as given by the lane output; drop evidence you cannot key".

### F4. Engine hygiene (found while mapping; cheap and demo-critical)

- **Stuck runs:** `claimRequest` accepts only `submitted`, and the restart hook in `GET /api/requests/[id]` (~L20-28) re-queues only `submitted`. A request left in `processing` by a server restart never runs again. Add a stale rule: `processing` or `waiting_for_user` with `updatedAt` older than 5 minutes and no open question → re-claimable.
- **Double execution:** `run_all.py` re-runs the three scripts (~L40-48). Give it `--inputs <dir>` so it reads the already-produced JSON from the workspace; the Funding lane passes the cached outputs. Halves Python time per run.
- **Chat re-runs lanes per message** (`answerOwnerMessage` ~L542). Persist the lane outputs at completion in a new `lane_outputs` collection keyed by request id (add to `Collection`, `loadDb`, `col`) and load them in chat instead of re-running. Needed for item 22's quick actions to feel instant.
- **Python on App Hosting** is unverified. Add a startup check that logs `python3 --version` and set `PYTHON_BIN` in `apphosting.yaml` if needed; the VPS Docker image already has `python3`.

### F5. Demo pack additions, then `node scripts/build-demo-from-pack.mjs`

- `demo/kedai-kopi-aminah/business_profile.json` (snake_case pack file): add `annual_sales_declared_rm: 235000` and map it in `scripts/build-demo-from-pack.mjs` (~L33-42, which copies only listed keys: `annualSalesDeclaredRm: p.annual_sales_declared_rm`). `classify.py` emits `declaredVsActual` only when the gap exceeds 5 %, and 235,000 vs 252,571.08 is about 7 %, so it triggers; 240,000 would not. Add `owner.muslimOwnershipPct: 100` (the `owner` object is copied wholesale) for zakat. `legalForm` is already "Sole proprietorship (Registration of Businesses Act 1956)".
- Keep closed days: change the build script filter (~L60) so Mondays and the six Raya rows are kept with `amountRm: 0` and their `note`, so the Raya dip is visible in the sales series. Change `analyze.py` (~L37) to count `openDays` only when `amountRm > 0`; today every row counts. Seasonal dips are revenue-based and unaffected.
- Do not touch the planted anomalies. Re-run `node scripts/score-result.mjs` after any pack change.

---

## 5. Phase 1: the demo cut

Each item: what the owner sees, what to build (by file), acceptance test.

### 22b. Conversational intake

**Owner sees.** The home page is one chat with Kak Kira. First bubble greets in the owner's language with two chips (EN / BM) and a "Cuba kedai kopi contoh / Try the demo café" chip. The owner drops files into the thread or taps the paperclip; each file becomes an attachment card (name, size, detected kind, row count, date range, tick when uploaded). Kak Kira replies with what she sees ("Nampak 308 hari jualan Okt 2025–Sep 2026, 26 invois pembekal, 1 penyata bank Sep 2026. Betul?") and asks only what the files cannot tell her, one bubble at a time with tap chips: business name, sector, declared annual sales (prefilled from the sales total, editable), goal, Shariah-only, service. The last bubble is "Baik, saya mula sekarang" and the six lanes appear.

**Build.**
- Move the form page to `app/start/page.tsx` (rename the current `app/page.tsx` component; keep `LandingHero`/`LandingSections` from `components/Landing.tsx` on the new home below the chat, or drop them if the chat is above the fold).
- Extract the file logic from `app/page.tsx` into `lib/intake-client.ts`: `ingest()` (~L274-317), `uploadDocs()` (~L247-271), `readJson()` (~L228), `loadBusiness()` (~L195-226), `loadDemo()` (~L326-338), `submit()` (~L340-392), `DEMO_FILES` (~L49-56), `annualSales()` from `lib/intake.ts`. Nothing in the parsing changes; `lib/csv.ts` and `lib/intake.ts` stay as they are.
- New `components/ChatIntake.tsx`: a thread state machine `greet → files → confirm → name → sector → sales → goal → shariah → service → consent → submitting`. Each step renders a bubble from `lib/i18n-chat.ts` (new file, `CHAT`/`ChatStrings`, en + ms) and chips. Attachment cards reuse `.chip`/`.card` styles; new CSS in `app/chat.css` (prefix `ch-`), imported in `app/layout.tsx`.
- Fix the `.heic` mismatch: either drop it from the input `accept` (~L490) or add it to `ALLOWED` in `app/api/upload/route.ts` (~L11).
- Submit posts the same bodies as today (`POST /api/businesses` then `POST /api/requests`), then `router.push('/r/{id}')`. Pass the chat language as `profile.language`.
- Mobile: the thread is full width; chips wrap; the composer is sticky at the bottom.

**Accept.** From a blank browser, drag the four demo CSVs onto the chat → attachment cards show kinds `sales/purchases/suppliers/bank` with row counts; the confirm bubble lists them; answering four chips reaches "mula sekarang" in under 60 s; the request lands on `/r/[id]` with lanes running. The `/start` form still submits. Typecheck passes with every `CHAT` key in both languages.

### 22. Chat-first brief with the artifact panel

**Owner sees.** `/r/[id]` is two panes. Left: the conversation continues (the intake thread is summarised in one bubble, then agent bubbles as lanes report, the owner question as a card inside the thread, then the answer bubbles and the Ask-your-CFO composer with four quick actions: Terang / Explain, Banding / Benchmark, Tentukan / Decide, Uji / Pressure-test). Right (sticky): the artifact, which persists after the chat ends: headline and found-money ledger, the three decision cards, the **numbers table** (every figure with its formula, its source chip and a `data` / `assumption` tag; assumption rows editable), application packs, verification. Two tabs above the table: **Utama** (the brief as delivered) and **Senario** (a copy where the owner edits assumption rows and the dependent figures recompute; nothing is saved unless "Simpan senario" posts it as a chat message). On mobile the panes become tabs "Sembang | Brief".

**Build.**
- Layout: wrap `Brief` (`app/r/[id]/page.tsx` ~L427-697) in a new `.cb-layout` (chat 1fr, artifact 440 px, sticky like `.qx-side`), widen the container to `.container` (1120 px). In-progress view uses the same layout so lanes (item 2) render as agent bubbles on the left while the artifact fills in on the right.
- Thread: new `components/CfoThread.tsx` that renders, in order: the intake summary (from `request` + `business` profile), progress entries grouped by lane (item 2), the `QuestionCard` inline (reuse ~L295-375), `messages` (existing `AskCfo` thread markup ~L834-947), and the composer. Quick-action chips always visible (move them out of the `messages.length === 0` branch ~L921-931); each chip posts a fixed prompt through the existing `ask(q)` (~L853): Terang → "Explain decision 1 in plain words, under 80 words"; Banding → "Compare my margin and supplier prices with similar kedai (say if it is a demo cohort)"; Tentukan → "If I can only do one thing this week, which decision and why"; Uji → "Pressure-test decision 1: what would make it wrong, and what should I check".
- Numbers table: the engine fills `result.numbers[]` (F1) from lane outputs in the Verifier pass; the prompt lists which numbers to include (12-month turnover, average monthly revenue, kopi-powder unit price first/last, extra paid, projected extra per year, duplicate amount, missing settlement, bank closing, SME category thresholds, each decision's `impactRm`). Each row: label, value, unit, formula string, source chip (item 1), basis tag. New `components/NumbersTable.tsx`.
- Senario: client-side only. Rows with `editable: true` and a `variable` name (e.g. `kopi_qty_order`, `kopi_price_new`) can be edited; formulas are evaluated by a small safe evaluator over the named variables (`lib/formula.ts`: tokens for numbers, variables, `+ − × / ( )`, no `eval`). Dependent rows show "recomputed". "Simpan senario" posts a chat message "Senario: kopi_qty_order = 15 → extra/yr RM1,310" so it lives in the thread.
- Chat reply schema (`ReplySchema` in `claude-cfo.ts` ~L508) gains optional `numbers[]` with the same shape as `result.numbers[]` so answers can add rows to the table.
- A chat message that asks for a new analysis ("Boleh ambil barista lagi RM1,800?") stays a chat answer in Phase 1 (grounded in cached lane outputs, F4). Starting a new run from chat is Phase 2.

**Accept.** Desktop 1280 px: chat left, artifact right, artifact stays in view while scrolling the thread. Click Terang → an answer bubble arrives from cached lane outputs in under 15 s. The numbers table shows at least ten rows, each with a formula and a source chip or an assumption tag. Editing `kopi_qty_order` in Senario changes `extra/yr` and leaves Utama unchanged. At 375 px the two tabs work and the composer is reachable.

### 2. Six agent lanes with step streams and a rolling RM counter

**Owner sees.** During the run, six lane bubbles (Bookkeeper, Reconciliation, Procurement, Classifier, Funding, Verifier) each with a state dot, elapsed time and plain-language steps appending every 2.5 s ("Reading 308 days of sales", "Matching 26 invoices to the bank", "LSS/2609/278 appears twice: RM642"). A counter in the artifact header ticks up as lanes report money findings.

**Build.**
- Replace the live-activity timeline (~L150-174) and the `TEAM` aside (~L182-207) with `components/LaneBoard.tsx` fed by `request.progress` grouped on `lane` (F2). Unify `TEAM` (~L50-57) with the engine lanes; add Reconciliation to `t.team` in `lib/i18n-app.ts` (en ~L37-44, ms ~L184-191); `agentIcon` (~L425) prefix-matches names, so give Reconciliation an icon from the existing `Icon` set (`calculator` or `shield`).
- Counter: sum `impactRm` across progress entries during the run; after completion switch to `impactTotals(result.decisions)` (`lib/impact.ts` ~L20). Reuse `FoundHeadline` (`components/DecisionAction.tsx` ~L585-639) for the frozen state; add a ticking variant (`useElapsed` pattern ~L163; respect `prefers-reduced-motion`).
- Verifier lane shows its `step` entries (one per verification check) as they arrive.

**Accept.** On the demo run all six lanes appear within 3 s; Reconciliation shows the RM642 duplicate as a step and the counter moves; the Verifier lane lists its checks; a failed lane shows red with its error instead of disappearing.

### 1. Evidence chips that open the source rows

**Owner sees.** Every ringgit in a decision card, the numbers table and chat answers is a chip. Tap → a drawer slides in with the rows behind it (date, supplier, item, qty, unit price, total, or the bank line), the file name and keys, and the formula.

**Build.**
- `components/EvidenceChip.tsx` + `components/RowsDrawer.tsx`; fetch `GET /api/requests/[id]/rows` (F3), cache per `(table, keys)` in component state.
- Render chips in the decision evidence list (~L578-602), chat `.a-ev` (~L896-914) and `NumbersTable`. `Nums` (~L394) already bolds money; wrap the bolded span in the chip when the enclosing evidence item has `source`.
- Fallback when `source` is missing: plain text (old results).

**Accept.** On the demo brief, the duplicate-payment decision's chip opens two bank lines (`IBG0915S02`, `IBG0916S02`, RM642 each) and the payables row; the kopi decision's chip opens the eight `KCB-26-*` purchase lines with unit prices 28.00 → 31.36. Drawer opens in under 300 ms on second open.

### 3. Named Verifier lane, planted error, worded confidence, checked / could not check

**Owner sees.** The Verifier ("Semak") is a visible lane that re-adds totals, confirms the bank reconciles (opening 18,450.00 → closing 16,959.22), rejects a false positive on stage ("RML2229, TGP 303: cash on delivery, no bank line expected"), and marks each decision Tinggi / Sederhana / Semak. Under the decisions, a box lists what was checked and what could not be (CCRIS, acquirer MDR, landlord SST status, supplier contract terms, rent and payroll as line items).

**Build.**
- Confidence: Verifier prompt rule: `high` when every figure traces to lane output with keys; `medium` when a default or assumption is used; `check` when an owner answer was missing or assumed. Render beside the priority tag (~L536-545) and in `.glance` (~L496); strings `t.confidence` as `Record<"high"|"medium"|"check", string>` in both languages.
- Not-checked list: after `parseStructured` (~L487), append server-side `notChecked[]` from (a) `laneData[agent].error`, (b) zero-row tables in `coverage()` (~L358-371), (c) a fixed market list in `workbuddy/knowledge/markets/MY/not_checkable.json` (CCRIS/CTOS, acquirer MDR, landlord SST registration, supplier contracts, payroll and rent unless uploaded). Add `status: "not_checked"` entries to `verification[]` too, and exclude them from the score at ~L433.
- Planted false positive: `analyze.py` already lists COD invoices under `normal_do_not_flag.cashOnDeliveryInvoices`; make the Verifier emit a `verification[]` item "RML2229, TGP 303: cash on delivery, no bank line expected" with `passed: true` so it shows as a rejected false positive. Do not use the words "missing payment", "unpaid" or "not paid" near "tong gas" or "mak long": `scripts/score-result.mjs` (~L61-62) counts that as a false positive. Keep the planted duplicate as the "caught" moment (Reconciliation finds it; the Verifier confirms "paid twice, once is enough").

**Accept.** Verification card shows ≥ 6 passed checks, 0 failed, ≥ 4 not-checked with reasons; each decision has a badge; `node scripts/score-result.mjs` still passes all 14 checks and the 4 false-positive checks.

### 4. Audience QR poll on the owner question

**Owner sees.** When Kak Kira asks ("RM39.90 beras dari Serba Murah: stok kedai, peribadi, atau campur?"), the card shows a QR code and a 6-character join code. Anyone opening `/p/<code>` on their phone votes without login; the tally updates live on the card; the presenter taps "Guna jawapan ramai" (use the audience answer) or the owner answers directly. The run continues and the artifact updates.

**Build.**
- New collection `votes` (`store.ts` `Collection` ~L28, `loadDb` ~L49, `firebase.ts` `col` ~L46-53): `{id, questionId, option, at, voter}`; `voter` = hashed cookie. Store functions `addVote`, `countVotes`, `tallyByQuestion`.
- Routes: `GET /api/polls/[code]` (question text + options + tally; `code` = first 6 chars of question id, lookup via `getQuestion`), `POST /api/polls/[code]/vote` `{option}` with its own `rateLimit(req, "vote:"+code, 300, 600)` and a cookie guard (one vote per cookie per question). Public page `app/p/[code]/page.tsx` (no chrome, big buttons, confirms the vote, shows the tally).
- `QuestionCard` (~L295-375): render a QR (inline SVG via a small dependency such as `qrcode`; add to `package.json`) for `${origin}/p/${code}`, poll `GET /api/polls/[code]` every 2 s while open, show counts per option, add the "use audience answer" button which calls the existing `POST /api/questions/[id]/answer` with the winning option.
- Keep the question open long enough: `BIZDECIDE_ASK_WAIT_MS` (section 3, decision 7).

**Accept.** Two phones vote on `/p/<code>`; the card shows 2 votes; the presenter's button posts the majority; `request.status` leaves `waiting_for_user` within 3 s; the Verifier's `owner_answers` includes it.

### 5. Found-money ledger with footnote and hours saved

**Build.** `impactBasis` and `hoursSavedPerMonth`/`hoursBasis` are produced by the Verifier (prompt: hours = a conservative estimate from the number of rows reconciled, stated as an assumption). `FoundHeadline` gets a footnote line (`t.foundBasis`) and a second figure "jam dijimat / hours saved". During the run the ticking counter from item 2 shows; on completion it freezes with the footnote.

**Accept.** The frozen header on the demo reads a total consistent with `impactTotals`, a footnote sentence, and an hours figure with its basis.

### 6. Funding ladder, TEKUN checklist, Shariah toggle, Budget 2027 line

**Owner sees.** Each pack carries a ladder "Dipadankan → Layak → Dokumen sedia" (Matched → Eligible → Document-ready); never "approved". TEKUN Niaga shows four documents with status: IC (missing), SSM (ready, from `profile.ssmNumber`), premises photos (missing), three months of bank statements (partial: Sep 2026 only, 1 of 3; "download Jul–Aug from Maybank2u"). A "Patuh Syariah sahaja / Shariah-compliant only" toggle above the packs filters them and shows the count. A grey line on relevant packs: "Budget 2027 (tabled 9 Oct 2026, not yet law): TEKUN allocation RM1.3bn".

**Build.**
- `funding_db.csv` and `.json`: add columns `shariah` (Y for TEKUN-NIAGA, MARA-SEMAI, AGRO-PENJAJA, SMEBANK-TECHAD and every CGC "-i" product; N/blank otherwise; mark blank as unknown, never assume) and `proposed_note`. Add both to the `setdefault` list in `run_all.py` (~L81) and to the candidate projection (~L164).
- New `workbuddy/knowledge/markets/MY/proposed_measures.json`: Budget 2027 items with `status: "proposed"`, `tabled: "2026-10-09"`, `source_url`. `marketKnowledge()` (`claude-cfo.ts` ~L191-206) includes it; prompts say to label them as proposed.
- Ladder: `run_all.py` emits `ladder: "matched"` for every candidate; the Verifier sets `eligible` when `verdict === "eligible"` and `document_ready` when every checklist item is `ready`. TEKUN checklist = the first four `documents` items of its row (the fifth "additional documents if applicable" is dropped); map to data in `run_all.py`: SSM ↔ `profile.ssmNumber`, bank statements ↔ months covered by `bank[]`, others `missing`.
- UI: `ApplicationPacks` (~L716-830): ladder pill in `.pack-top`, toggle in `.section-head` (`.chip-toggle`), per-pack `tag` "Syariah", `proposedNotes` rendered grey with the date.

**Accept.** Demo brief shows three packs; TEKUN's checklist reads 1 ready / 1 partial / 2 missing; toggling Shariah hides any pack whose `shariah` is not `true` and shows "2 daripada 3"; no pack says "approved"; the proposed line carries the date.

### 7. Price Movers decision card with sparkline and SST note

**Owner sees.** Decision #1: "Serbuk Kopi O Campuran naik 12% dalam 8 invois sejak Jun; tiada notis dari Kopi Cap Bintang (Syarikat Kopi Cap Bintang Timur Sdn Bhd, S01)" with a per-SKU sparkline (28.00 → 31.36), extra paid so far RM147.62, projected RM983/yr at current volume, the eight invoice chips, and one line on tax: the SST status of the item from the lookup, or "SST status not verified" when unknown. (For milk-type items the line reads "0% sales tax: this is margin, not tax".)

**Build.**
- `track.py`: add `history: [{date, price, invoice, qty}]` for every tracked item (from `rows` ~L29-30), `sstRatePct`/`sstNote`/`sstSource` via `workbuddy/skills/supplier-price-tracker/references/sst_rates.json` (keyword → rate with `source_url`; `susu`/`milk`/`beras`/`rice`/`sayur` → 0 with the StoreHub SST list as source; unknown → `null`). Skills must stay self-contained (`workbuddy/skills/README.md`). Bump the skill `version`.
- `run_all.py`: add `history`, `sstRatePct`, `sstNote` to the whitelist (~L135).
- UI: `components/Sparkline.tsx` (inline SVG, 8 points, first/last labels); the decision card renders it when the decision's evidence has `source.table === "purchases"` and the result's numbers include a series (put `history` into `result.numbers[]` as a `series` field, or add `series?: {date: string; value: number}[]` to the evidence item in F1).

**Accept.** Sparkline shows 8 points rising in three steps (four price levels); the card quotes 28.00 and 31.36 and RM983/yr; the SST line cites a source or says "not verified".

### 8. Classifier guardrails

**Build.**
- `classify.py`: read `profileExtras.legalForm` and `profileExtras.groupOwnership`; `independent = legalForm in (sole proprietorship, partnership) or groupOwnership == "independent"`; if a company with unknown ties → `assistanceEligibility: "cannot_determine"` and `unknownForEligibility += ["groupOwnership"]`, while `category` (size) is still returned as `sizeCategory`. Emit `einvoice: {thresholdRm: 3_000_000, status: exempt|required|cannot_determine, headroomRm, declaredRm, actualRm, ruleVersion: "LHDN guideline v4.8, 30 Aug 2026", sourceUrl}`. Keep `next.salesHeadroom` in RM (already is). Put the group rule into `sme_rules.json` as a `group_rule` object and make `classify.py` read `sme_rules.json` instead of its hard-coded `RULES` (~L14-17); copy `sme_rules.json` into `workbuddy/skills/sme-classifier/` (skills must be self-contained) and bump the skill `version` (now 1.1.1). Match `legalForm` by case-insensitive prefix: the demo value is "Sole proprietorship (Registration of Businesses Act 1956)".
- `run_all.py` (~L148) copies the new fields through.
- Prompts: "If `assistanceEligibility` is `cannot_determine`, ask the owner with `ask_owner` (options: independent / part of a group / not sure)"; "Proposed measures are labelled as proposed; never present them as current rules".

**Accept.** Demo (sole proprietorship): no group question is asked; `einvoice.status = exempt`, `headroomRm ≈ 2,747,429`. A test profile with `legalForm: "Sdn Bhd"` and no `groupOwnership` triggers the question.

### 9. Deterministic seed, cached replay, recording

**Build.**
- Capture one good run: new `scripts/capture-demo-run.mjs` reads the latest completed request from the store (`.data/db.json` in local mode) and writes `docs/demo-run.fixture.json` `{progress[], result, laneOutputs}` with relative timestamps.
- Replay: `BIZDECIDE_REPLAY=1` makes `processRequest` (after `claimRequest`) replay the fixture: write each progress entry with its original delay (cap 25 s per lane), create the fixture's question and wait for the answer (so the poll still works live), then `saveResult`. Lane outputs come from the fixture, so chat works offline too.
- Seed: `scripts/seed-demo-run.mjs` writes a completed request + result from the fixture for UI work without any API key.
- Recording: record the replay at 1280×800 as the backup video; keep it on the presenter's laptop and phone.

**Accept.** With `ANTHROPIC_API_KEY` unset and `BIZDECIDE_REPLAY=1`, the demo café runs end to end in under 3 minutes with identical numbers every time, including the poll.

### 10. Kak Kira voice and copy (BizDecide stays the brand)

**Build.**
- `NEXT_PUBLIC_PERSONA=kakkira|off` (default `kakkira`). When on: brief subtitle "Kak Kira · CFO AI anda / your AI CFO", chat bubbles from "Kak Kira", greeting in the intake, and three tics in `ANALYSIS_PROMPT`/`CHAT_PROMPT`: ringgit number first; name the supplier; close with "Tentukan: ya atau tak?". When off: "BizDecide CFO".
- Strings in `lib/i18n-app.ts`, `lib/i18n-chat.ts`, `lib/i18n-actions.ts`; disclaimer line in the footer (`components/SiteChrome.tsx`) and under the composer.

**Accept.** Toggle flips every owner-facing name; no restricted words appear (grep for "adviser", "penasihat", "planner", "perancang", "akauntan", "approved").

---

## 6. Phase 2

### 11. Decision log and audit tab
- New collection `decision_log` `{id, requestId, decisionIndex, verdict: "accept"|"ask_why"|"not_now", at, note?}`; routes `GET/POST /api/requests/[id]/log`.
- On each decision card: Accept (also triggers the existing `DecisionAction` approve), Ask why (prefills the composer with "Why decision N?"), Not now (stores with an optional reason). Audit tab in the artifact: log entries + actions (`listActions`) + verification, newest first.
- This is the raw material of the succession pack (item 16) and the follow-up loop (item 15).

### 13. e-Invoice status card
- Data from item 8 (`einvoice` on the classifier output → `result.einvoice`). Card in the artifact: status, declared vs bank-implied revenue (12-month sales total), headroom in RM, "rule changed three times since Jun 2025" with the version and source, next check date (1 Jan 2028 enforcement per the knowledge file), and the group-rule caveat. Copy must never say "you are compliant".

### 12. Zakat perniagaan tile
- `analyze.py`: `zakat` block with `untungRugiRm = max(0, turnover12m − costs12m) × 0.025` and `modalKerjaRm = max(0, closingBalance − unpaidPayables) × 0.025 × muslimOwnershipPct/100`, `nisabRm` from a new `workbuddy/knowledge/markets/MY/zakat.json` (`nisab_2026_rm: 33996`, methods, `source_url`), `assumptions` ("purchases cover Jun–Sep 2026 only; rent and payroll not in the ledger"). `muslimOwnershipPct` from `profileExtras.owner.muslimOwnershipPct`; if absent the engine asks once.
- Tile shows both figures, nisab, haul note and the method source; marked `check` when assumptions apply.

### 14. Payments and channel margin ledger
- From the Bookkeeper lane `channelTotals12m`, Reconciliation `cardMerchantDiscountRatePct` and `deliveryPayoutChecks[]`. New `workbuddy/knowledge/markets/MY/payment_fees.json` (DuitNow QR 0.25 % waived for micro and small; TNG Business 0 %; Boost 1 %; ShopeePay 1 %; delivery commission 15–30 % as an assumption range; each with `source_url`).
- `result.channels[]`: gross, fees (data where measured, assumption otherwise), net, and one decision candidate "move RM X of card volume to DuitNow QR saves RM Y/yr" with the Verifier footnote "assumes your acquirer waives MDR; check your statement". Per-item margin is out of scope (no item lines in sales).

### 15. Morning note and "did it work?" loop
- At completion the Verifier writes `morningNote.lines` (4 lines in the owner's language: sales this week, stock/cash signal, supplier due, one action). Shown at the top of the thread with a "Hantar ke WhatsApp" button (`https://wa.me/?text=` with the lines) and a "Dengar" button that uses `speechSynthesis` with `ms-MY`/`en-MY` voices when available.
- Follow-up: when a new request completes for the same `businessId`, load that business's `decision_log` entries with `accept`, ask the Verifier to compare each accepted decision's `impactRm` with the new lane outputs (e.g. kopi unit price now vs then; duplicate recovered or not) and fill `result.followUps[]`; render "Keputusan 1: jadi / separuh / belum" cards.

### 16. Share-with-accountant link and succession pack
- `GET /api/requests/[id]/share` creates a token (HMAC like `makeDataLink` in `lib/data-link.ts`, 30-day TTL); `app/s/[token]/page.tsx` renders the brief read-only with the verification log, the numbers table and source rows enabled, no composer, no actions.
- Succession pack: `app/r/[id]/pack/page.tsx` (print layout like `app/r/[id]/a/[actionId]`): business facts, decision log, suppliers with terms and price history, recurring obligations (SST filing, zakat, EPF/SOCSO dates from a new `obligations.json`), funding packs, adviser contacts (from `profileExtras`), access handover checklist. "Save as PDF" = `window.print()`.

### 20. Peer benchmark line
- `workbuddy/knowledge/markets/MY/benchmarks_demo.json`: five micro sectors (kedai kopi, warung, runcit, kontraktor kecil, salon) with gross margin, kopi-powder RM/kg range, QR share, days of cash; every entry labelled `"synthetic": true, "label": "demo cohort, not survey data"`. The Verifier fills `result.benchmarks[]` only for metrics the lanes computed. One line under the relevant chart: "Kedai kopi serupa bayar RM27–29/kg; anda bayar RM31.36" with the cohort label visible. Never present it as survey data.

---

## 7. Demo run book (3 minutes, real data)

| Time | Screen | Say |
|---|---|---|
| 0:00 | Black slide: "Aminah runs a kedai kopi in Petaling Jaya. Last month she paid one bill twice and her coffee powder went up 12%. Nobody told her." | Silence, then the line. |
| 0:10 | Chat intake; drop `sales.csv`, `purchases.csv`, `suppliers.csv`, `bank.csv` | "No accountant. Four exports. Here is her year." |
| 0:30 | Kak Kira confirms the files; tap sector, sales, goal, service chips; "mula sekarang" | — |
| 0:45 | Six lanes stream; Reconciliation posts "LSS/2609/278 paid twice: RM642"; counter ticks | "Six agents. Watch Reconciliation." |
| 1:15 | Question card with QR: "RM39.90 beras dari Serba Murah: stok, peribadi, atau campur?" | "Aminah isn't here. You are. Vote." Use the audience answer. |
| 1:40 | Second question (household income) answered by the presenter as owner; funding list re-sorts | "This one flips which schemes she can touch." |
| 1:55 | Verifier lane: checks tick; "RML2229, TGP 303: cash on delivery, no bank line expected" | "It rejected its own false alarm." |
| 2:10 | Artifact: three decisions; click the kopi chip → eight invoices; sparkline 28.00 → 31.36 | "Every ringgit has a receipt." |
| 2:30 | Packs: TEKUN 1 ready / 1 partial / 2 missing; Shariah toggle; proposed Budget 2027 line | "Three schemes, not 140. One is ready today." |
| 2:45 | Found-money header freezes with footnote; morning note; Terang chip answers in BM | — |
| 2:55 | Close slide: "Not a report. Three decisions and a loan application." QR to the brief. One screenshot of the skill inside WorkBuddy. | Stop at 3:00. |

Fallbacks: `BIZDECIDE_REPLAY=1` run on a second laptop; the screen recording on the phone; show-of-hands if the poll page fails; phone hotspot as the second network.

---

## 8. Verification checklist

1. `npm run typecheck` and `npm run build` pass.
2. Local run with `BIZDECIDE_STORE=local`, `ANTHROPIC_API_KEY`, `python3`: demo café completes; `node scripts/score-result.mjs` passes all checks.
3. Replay run with `BIZDECIDE_REPLAY=1` and no API key completes with identical numbers.
4. WorkBuddy path: `submit_results` with a result that includes the new fields is accepted (test with the MCP inspector or a curl against `/api/mcp` with the bearer key); `update_request` with `lane`/`state` is stored.
5. Old results: open a brief saved before the schema change; no crash, missing sections hidden.
6. Both languages: switch EN/BM on the intake and the brief; no missing-key fallbacks.
7. Mobile 375 px: intake chat, lanes, tabs, poll page, decision cards, packs all usable.
8. Wording grep returns nothing: `grep -rniE "adviser|penasihat|planner|perancang|akauntan|approved" lib/i18n* lib/claude-prompts.ts components app --include=*.ts --include=*.tsx`.
9. Evidence: every decision on the demo brief has at least one chip that opens rows.
10. Poll: two devices vote; the tally shows; the run continues.

---

## 9. Do not

- Do not run `npm run demo:data` (old generator). Rebuild with `node scripts/build-demo-from-pack.mjs`.
- Do not change the planted anomalies or the answer key.
- Do not add non-stdlib Python packages (Docker has no pip; skills must stay self-contained).
- Do not remove or rename existing result fields; add only.
- Do not say "approved", "compliant", "financial adviser", "financial planner", "AI accountant" anywhere owner-facing.
- Do not present the demo benchmark cohort as survey data.
- Do not present Budget 2027 figures as law.
- Do not block the run on the poll: the question still expires to its default after `BIZDECIDE_ASK_WAIT_MS`.

## 10. Needs a human

- Confirm `python3` exists on the Firebase App Hosting image (or deploy the VPS Docker path for the demo). Note `apphosting.yaml` has `timeoutSeconds: 120`, below the engine's 120 s question wait plus analysis time; raise it or demo from the VPS.
- Confirm with the organisers the Hackerdorm rubric and demo length (the plan assumes 3 minutes plus Q&A).
- Register nothing: the name stays BizDecide; bizdecide.my/.com.my/.ai/.app were free on 10 Oct 2026 if wanted later.
- Decide whether the SG market returns (removed in the working tree; `PACKS = [MY]`).
