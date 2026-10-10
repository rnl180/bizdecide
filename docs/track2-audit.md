# Track 2 implementation audit

Scope: the two supplied Track 2 slides (problem statement, expected capabilities,
five judging criteria and core judging question). No additional competition rules,
submission form requirements or live platform behaviour are assumed.

## Judging criteria

| Criterion | Implementation and evidence | What still needs demonstration |
|---|---|---|
| Real problem and user value | SME financial review with actionable, source-backed decisions. The demo contains a RM642 potential overpayment and a supplier price increase projected at RM82.13/month. Tests recalculate those effects. | A real user's benefit; these are potential recoveries/savings, not money already recovered or observed ROI. |
| Agentic workflow | WorkBuddy instructions cover goal-specific planning, tools, parallel Python stages, essential owner questions, verification, repair after rejection and delivery. `run_all.py` preserves successful stages when another fails. | One real WorkBuddy run showing that it follows the plan and adapts without step-by-step operator guidance. Parallel scripts are not proof of independent AI-agent collaboration. |
| Meaningful WorkBuddy use | WorkBuddy is the default engine even with an Anthropic key present. MCP supplies data and independent arithmetic checks, accepts evidence-backed reports, and delivers approved actions. Direct Claude execution requires explicit opt-in. | WorkBuddy connected to this deployed backend and actually executing the workflow. The optional Claude path is not evidence of WorkBuddy compliance. |
| End-to-end execution | Upload → claim → plan → analyse → clarify if necessary → verify → report → owner approval → prepared email/document. Claims recover after interruption; old workers cannot overwrite new runs. Duplicate approvals reuse one action. | A live prompt-to-artifact recording. Define the goal as preparing the action: a ready refund request is not a completed bank refund. Owner approval is a business decision, not manual orchestration of intermediate steps. |
| Usable and verifiable results | Source keys belong to the uploaded business. Supported decision amounts are recomputed server-side; wrong amounts/periods and duplicate effects are rejected. Required artifact types are enforced, financial cents are preserved, and unperformed checks remain labelled not checked. | Human inspection of the generated wording and facts; real platform/cloud execution. Arbitrary prose amounts, optional report tables, programme availability and completeness of uploaded records are not independently established by these checks. |

## Expected agent capabilities

| Capability | Implementation |
|---|---|
| Understand the goal | Request service, profile goal and language are passed to WorkBuddy. |
| Plan tasks | WorkBuddy records a short goal-specific plan in progress detail; the owner can inspect it. |
| Execute actions | Tool calls, Python analysis, report delivery and artifact preparation. External sending is outside the prepared-draft goal. |
| Collaborate and validate | Essential owner questions, source evidence, independent server arithmetic and a verification stage. Separate AI agents are an optional example on the slides, not an assumed requirement. |
| Integrate results | Orchestrator combines successful stage results and errors; WorkBuddy selects decisions and applies owner answers. Recovery retains answered facts. |
| Deliver the final outcome | A readable brief and, after approval, the required email or application document with a printable view. Empty completion is rejected. |

## Additional gaps repaired in this audit

- Protected action and message completion with independent worker leases; made concurrent approvals idempotent.
- Required application documents for financing and emails for refund/supplier actions.
- Prevented late answers from reopening closed owner questions; preserved earlier answers on recovery.
- Accepted monthly sales without crashing daily reconciliation, and returned explicit limitations.
- Stopped treating incomplete sales periods as annual turnover. A complete consecutive year is required; otherwise use a labelled declared annual figure or leave annual sales unknown.
- Preserved useful stage results when a stage returns malformed output or times out. Funding screens retain missing information and never establish full eligibility on their own.
- Excluded ambiguous multi-invoice transfers from independent refund calculations.
- Preserved cents in the displayed financial effects and labelled projections/potential recovery honestly.
- Aligned shipped skill descriptions, versions and setup instructions with the actual code.

## Reproducible checks

`npm test` exercises calculation integrity, incomplete/monthly data, a failed stage,
claim races, stale workers, owner answers and required artifacts. `npm run build`
checks the production build and TypeScript integration.

With a local production server configured for WorkBuddy and a local MCP key, run:

```sh
BIZDECIDE_MCP_KEY=<local-test-key> node tests/mcp-refund.smoke.mjs
```

The smoke test simulates MCP calls. It checks planning/progress, an owner question,
Python execution over a data link, rejected wrong amounts, repaired delivery,
simultaneous approvals, required refund output, and a follow-up answer. It does not
run an LLM or WorkBuddy, save a Gmail draft, send an email, or test cloud Firestore.

## Remaining live acceptance run

1. Refresh the WorkBuddy MCP tools and import the updated instructions/skill versions.
2. Upload the demo data, then issue one goal: “Review this business, identify supported savings or recovery opportunities, and prepare the action I approve.”
3. Observe the saved plan, actual tool/script execution and any essential question. Do not manually dictate the intermediate tool calls.
4. Verify the RM642 evidence and the conditional supplier projection. Approve the refund and inspect the produced email, invoice, references and amount.
5. Repeat with incomplete/monthly data or a failed stage. Confirm WorkBuddy explains the limitation, repairs what it can and does not invent eligibility or financial impact.

Code and simulated integration checks cover the core architecture. Full operational
compliance remains unconfirmed until this live run succeeds; judging is based on the
actual demonstrated outcome.
