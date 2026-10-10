# BizDecide

**Your AI CFO. Not reports. Decisions.**

BizDecide is an AI CFO for Malaysian small businesses. Owners upload their sales, purchases and suppliers. An agent running on **Tencent WorkBuddy** plans the work, calls analysis tools, checks the evidence, asks the owner only when needed, and delivers **up to three concrete decisions** with supported ringgit impact and evidence.

> Built for AI Hackerdorm 2026 · Track 2: WorkBuddy Agentic Solutions

## The problem
- Malaysia has 1,101,725 MSMEs, 96.9% of all businesses, and 7 in 10 are micro enterprises (SME Corp / DOSM, 2023). They produce 39.7% of GDP (DOSM, 2025).
- 67% of SMEs say rising costs are their top pressure, 42% cite managing cash flow, and 1 in 5 name rising supplier costs as a main cost driver (Airwallex Malaysia SME Business Outlook 2026, n = 415).
- About 140 financing schemes exist (Entrepreneur Development and Cooperatives Ministry, Aug 2026), yet 50.6% of businesses don't know the development finance institutions that run them, and only 1 in 3 micro firms has any bank facility (ACCCIM M-BECS H1 2026).

Sources for every figure: [research/market_stats.md](research/market_stats.md).
- Accounting software records the past. Owners need someone to tell them **what to do next**.

## How it works

```
Owner ──► BizDecide app (Next.js, Firebase App Hosting)
              │  collects profile, sales, purchases, suppliers, documents
              ▼
          Firestore + Firebase Storage
              ▲
              │  MCP (Streamable HTTP, bearer auth)  ── /api/mcp
              │
          Tencent WorkBuddy  ◄── the brain: plans, runs skill scripts in parallel,
                                  verifies, asks the owner, delivers the CFO brief
```

WorkBuddy owns planning, analysis and decisions. The backend independently recalculates supported financial effects before accepting a brief.

| Workflow role | Job | Implementation |
|---|---|---|
| Bookkeeper | Sales, supplier purchases, payment reconciliation, candidate overpayments | `financial-analyzer` |
| Procurement | Hidden supplier price rises, alternatives | `supplier-price-tracker` |
| Classifier | Official SME category (SME Corp rules) | `sme-classifier` |
| Funding | Programme pre-screen, remaining eligibility review, official links | `run_all.py` + WorkBuddy |
| Verifier | Reconcile totals, check every link and figure, replace what fails | — |
| Delivery | Supported decisions → `submit_results`; approved emails/documents → `complete_action` | WorkBuddy + printable app output |

These are workflow roles. The WorkBuddy path runs three Python scripts in parallel;
it does not by itself prove collaboration between multiple independent AI agents.

### MCP tools
`ping` · `wait_for_request` · `list_pending_requests` · `claim_request` · `get_data_link` · `get_business_data` · `get_impact_checks` · `update_request` · `ask_user` · `get_answer` · `reply_to_owner` · `submit_results` · `complete_action`

`ask_user` powers the live poll: the agent asks, the owner taps an answer (or types "Other") in the app, and the agent continues.

`wait_for_request` atomically claims new or interrupted work. Keep its `request.claimToken` for progress, questions and delivery; one-off workers use `claim_request` after listing. After ten minutes without progress a run can be reclaimed, and its old token can no longer change the request. Local storage coordinates one Node process (including its route bundles); use Firestore transactions for multiple server instances.

Approved actions and owner messages have separate claim tokens: pass `action.claimToken` to `complete_action` and `message.claimToken` to `reply_to_owner`. Stale workers cannot overwrite recovered work. Concurrent approvals reuse one action per decision. Recovered requests include earlier owner answers. Refund/supplier actions require an email; financing requires an application document.

New briefs require evidence for every decision and at least one passed verification check. Source keys must exist in the same business's uploaded data. Rejected delivery leaves the request in progress and saves no result. Saving the accepted result and marking the request completed happen in one transaction. Historical briefs remain readable.

Every numeric decision `impactRm` also needs an `impactCheckId` from `get_impact_checks`, the exact amount/type and all calculation sources. Delivery recomputes it from the full business records, independently of the agent or Python lane output. Supported checks: overpayment (distinct invoice-linked payments minus one ledger obligation), QR/card settlement query gross amount, and monthly supplier price increase at historical volume/frequency. Amounts must match to the cent; the same effect cannot be counted twice. Unknown effects and proposed financing omit `impactRm`. The server records its calculation and preserves assumptions: a missing settlement is a query, and supplier savings are conditional projections. This validates structured decision effects, not every amount in free text or optional report tables, and cannot prove that uploaded records are complete.

### Beyond the brief
- **Funding application pack.** For the top programmes the business qualifies for, the agents build the application: a document checklist marked ready / partial / missing against the data already uploaded, pre-filled form answers, a suggested amount, repayment and affordability, and next steps. Printable per programme. No Malaysian accounting tool does this (see [research/competitors.md](research/competitors.md)).
- **Ask your CFO.** On the brief page the owner asks follow-up questions ("Can I afford the RM40k loan?"). The on-duty WorkBuddy agent picks them up through `wait_for_request` and answers from the owner's own numbers with `reply_to_owner`, with evidence.
- **Built for Malaysia.** Malaysian knowledge (SME Corp 2024 definition, 20 funding programmes with required documents, DuitNow/card settlement rules, states, Bahasa Melayu glossary) lives in [workbuddy/knowledge/markets/MY/](workbuddy/knowledge/markets/README.md). The folder layout keeps other countries possible later, but BizDecide covers Malaysia only. "See it on a sample kopitiam" loads the demo business (Rock Cafe).
- **Bahasa Melayu.** The intake form switches between English and Bahasa Melayu, and the brief comes back in the owner's language.
- **POS exports.** StoreHub sales exports (Offline Transactions or Sales Over Time) upload as-is.

## Run locally

```bash
npm install
cp .env.example .env      # fill in Firebase service account (base64) + BIZDECIDE_MCP_KEY (+ ANTHROPIC_API_KEY)
npm run dev               # http://localhost:3100
```

## Claude engine (optional)

WorkBuddy is the default, even when an Anthropic key is present. To opt into the direct API engine, set **both** `BIZDECIDE_ENGINE=claude` and `ANTHROPIC_API_KEY`. The server then runs the CFO team itself on the Claude API (`lib/claude-cfo.ts`), with no WorkBuddy loop needed:
- **Analysis agent** (Claude Opus 5.5, effort high) calls five lanes in parallel: Bookkeeper, Reconciliation, Procurement, Classifier and Funding. Each lane runs the same Python skill scripts, so every number is computed from the data. The agent asks the owner through the live poll when it must, then drafts the brief.
- **Verifier agent** (Claude Opus 5.5, effort high) checks every figure against the lane outputs and returns the final brief as structured output.
- **Ask your CFO** follow-ups are answered the same way.

Needs `python3` on the server (the Docker image installs it). Use `BIZDECIDE_ENGINE=workbuddy` for the WorkBuddy workflow through `/api/mcp`.

## Deploy (Firebase App Hosting)

1. Firebase console → create project → enable **Firestore** and **Storage** (Blaze plan needed for App Hosting).
2. `firebase apphosting:secrets:set bizdecide-mcp-key` (value from `openssl rand -hex 32`).
3. Set your bucket in `apphosting.yaml`.
4. Firebase console → App Hosting → connect this GitHub repo → deploy.
5. `firebase deploy --only firestore:rules,storage` to lock down direct access.

## Connect WorkBuddy

1. WorkBuddy → **Connections → Custom connections → Configure MCP** (or Settings → MCP).
2. Paste `workbuddy/mcp.example.json` with your URL and key → Save → toggle **bizdecide** on.
3. Test: *"Use the bizdecide ping tool with name Ahmad"* → `Hello Ahmad from BizDecide`.
4. Add `workbuddy/bizdecide_instructions.md` and `workbuddy/knowledge/` to the WorkBuddy workspace.
5. Import the three shipped skills and add `run_all.py` to the workspace; see `workbuddy/skills/README.md` for the actual package contents.
6. Run: **"Process new BizDecide requests"**.

## Track 2 criteria and verification

See [the criteria audit](docs/track2-audit.md) for the mapping to the supplied judging
slides, implemented checks and the remaining live WorkBuddy demonstration. Passing
the local tests establishes integration behaviour, not autonomous execution by
WorkBuddy or final approval by the judges.

## Demo

Click **Load demo café: Rock Cafe** on the home page. The data (`npm run demo:data`) hides four things for the agents to find:

1. Star Coffee Trading raised coffee powder prices 12%, while its other items stayed flat.
2. Invoice `LSS/2609/278` (RM642) was paid twice, on 15 and 16 September 2026.
3. DuitNow QR sales of RM312.40 on 18 September have no matching settlement.
4. A RM144.15 Value Mart receipt mixes business and personal items → live question to the owner.

The focused demo is **duplicate payment → proof → approve → refund email ready to send**. WorkBuddy receives the uploaded bank and invoice rows when it picks up the approved action. `complete_action` rejects a summary without an actual deliverable; refunds require an email. Nothing is sent automatically.

`npm test` checks the demo findings, evidence selection, engine choice and action completion. `npm run build` checks the production build. Against a fresh local server, `BIZDECIDE_MCP_KEY=<your-local-key> node tests/mcp-refund.smoke.mjs` exercises the HTTP/MCP flow with a simulated WorkBuddy client and leaves a clearly labelled demo brief. This tests the integration, not WorkBuddy's model or Gmail connector.

## Distribution
1. **The app** for owners who have never heard of WorkBuddy.
2. **The skills** for accountants and SME consultants who already use WorkBuddy: downloadable from the app at `/skills` (import the `.zip` in WorkBuddy), and published to the WorkBuddy Skill Marketplace.

## Repo
```
app/            Next.js pages + API routes (/api/mcp is the MCP server)
lib/            Firebase admin, Firestore store, shared types (the app ↔ agent contract)
workbuddy/      Agent instructions, knowledge base, skill prompts, MCP config
public/demo/    Demo business data (JSON + CSV)
scripts/        Demo data generator
```

License: MIT
