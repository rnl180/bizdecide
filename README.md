# BizDecide

**Your AI CFO. Not reports. Decisions.**

BizDecide is an AI CFO for Malaysian small businesses. Owners upload their sales, purchases and suppliers. A team of AI agents running on **Tencent WorkBuddy** analyses the data, verifies its own work, asks the owner only when it must, and delivers **three concrete decisions** with ringgit impact and evidence.

> Built for AI Hackerdorm 2026 · Track 2: WorkBuddy Agentic Solutions

## The problem
- Malaysia has ~1.3M MSMEs (96% of all businesses); 77%+ are micro enterprises with no finance staff.
- 67% of SMEs say rising costs are their top pressure; 42% struggle with cash flow (Airwallex SME Outlook 2026).
- 60% of owners don't know which financing options exist (SME Corp & Huawei survey).
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
          Tencent WorkBuddy  ◄── the brain: plans, runs agents + skills in parallel,
                                  verifies, asks the owner, delivers the CFO brief
```

The app and the MCP server **only move data**. All intelligence runs in WorkBuddy.

| Agent (WorkBuddy) | Job | Skill |
|---|---|---|
| Bookkeeper | P&L, costs by category, margin, duplicates | `financial-analyzer` |
| Procurement | Hidden supplier price rises, alternatives | `supplier-price-tracker` |
| Classifier | Official SME category (SME Corp rules) | `sme-classifier` |
| Funding | Eligible Malaysian programmes, official links | `funding-matcher` |
| Verifier | Reconcile totals, check every link and figure, replace what fails | — |
| Delivery | 3 decisions → `submit_results` (+ PDF) | `brief-writer` |

### MCP tools
`ping` · `list_pending_requests` · `get_business_data` · `update_request` · `ask_user` · `get_answer` · `submit_results`

`ask_user` powers the live poll: the agent asks, the owner taps an answer (or types "Other") in the app, and the agent continues.

## Run locally

```bash
npm install
cp .env.example .env      # fill in Firebase service account (base64) + BIZDECIDE_MCP_KEY
npm run dev               # http://localhost:3000
```

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
5. Generate the skills in WorkBuddy using the prompts in `workbuddy/skills/README.md`.
6. Run: **"Process new BizDecide requests"**.

## Demo

Click **Load demo café: Kedai Kopi Aminah** on the home page. The data (`npm run demo:data`) hides four things for the agents to find:

1. Ladang Segar Dairy quietly raised milk ~12% in Aug–Sep 2026.
2. Invoice `KB-2609` uploaded twice.
3. A RM2,399 Harvey Norman purchase: business or personal? → live question to the owner.
4. Declared sales RM240k, but uploaded sales show ~RM384k → SME category check.

## Distribution
1. **The app** for owners who have never heard of WorkBuddy.
2. **The skills** published to the WorkBuddy Skill Marketplace for accountants and SME consultants who already use it.

## Repo
```
app/            Next.js pages + API routes (/api/mcp is the MCP server)
lib/            Firebase admin, Firestore store, shared types (the app ↔ agent contract)
workbuddy/      Agent instructions, knowledge base, skill prompts, MCP config
public/demo/    Demo business data (JSON + CSV)
scripts/        Demo data generator
```

License: MIT
