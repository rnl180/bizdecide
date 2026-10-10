# What makes agent/finance demos produce a "damn", and the UX patterns behind it
10 Oct 2026. [V] vendor, [T] third-party/design write-up, [R] peer-reviewed, [I] inference, [VERIFY].

## 1. What actually produces the "damn"
1. **The audience watches work happen, not a result appear.** Manus's "Manus's Computer" window, Devin's real-time progress, Ramp admins who "watch decisions stream in, override edge cases".
2. **One legible number lands early.** Ramp opens on a $5 latte that costs "14 minutes of blended labor, and over $20 in overhead"; Intuit leads with "up to 12 hours" a month; Rocket Money leads with a billion-dollar counter.
3. **The agent stops and asks.** Operator, Project Mariner, Lindy, Manus pause for confirmation; Smashing's "Escalation Pathway": "A well-designed agent doesn't guess; it escalates."
4. **Every number is traceable.** Ramp: "Every action comes with a rationale"; Devin Search answers with "cited code"; explanations raise adoption and repair trust after an error.
5. **Honest limits.** Hackathon winner analyses reward "honestly named limits"; first-person uncertainty wording reduces over-reliance.

## 2. Pattern library (22)
1. **Plan-first / Intent Preview** — Devin 2.0 drafts a "preliminary plan" you edit "before letting Devin work autonomously" (https://cognition.com/blog/devin-2); Smashing "Intent Preview" (https://smashingmagazine.com/2026/02/designing-agentic-ai-practical-ux-patterns/). BizDecide: after upload, a 6-line plan card ("Bookkeeper: reconcile 1,240 rows · Procurement: price-check 38 suppliers …") with Edit / Go.
2. **Live step stream** — Manus's Computer window "watch the agent's actions in real time and step in" (https://www.technologyreview.com/2025/03/11/1113133/manus-ai-review/); Anthropic visible thinking (https://www.anthropic.com/news/visible-extended-thinking). BizDecide: each agent card scrolls plain-language actions.
3. **Parallel agent lanes** — Devin "multiple Devins at once"; Manus Wide Research; AutoGen Studio live streaming between agents; Anthropic "orchestrator-workers" (https://www.anthropic.com/research/building-effective-agents); WorkBuddy "multi-expert collaboration" (https://www.tencentcloud.com/act/pro/workbuddy). BizDecide: six swimlanes with progress, elapsed time, status verb.
4. **"Needs your input" interrupt card** — Mariner "asks users for final confirmation before taking certain sensitive actions" (https://blog.google/technology/google-deepmind/google-gemini-ai-update-december-2024/); Manus "asks clarifying questions during work". BizDecide: mid-run poll card "Supplier B is 11% cheaper but 4 days slower — which matters more this month?" Two big buttons; the lane visibly waits.
5. **Takeover for the sensitive bit** — Operator "takeover mode" for credentials/payments. BizDecide: funding pack fills everything except signature and bank details, handed over on a "You do this part" card.
6. **Rationale on every action** — Ramp "Every action comes with a rationale", "Full auditability" (https://ramp.com/blog/ramp-agents-announcement); HAX G11 (https://www.microsoft.com/en-us/haxtoolkit/library/). BizDecide: one-line "Why": "Because 31% of April purchases were from Supplier A at above-median price."
7. **Source chip on every number** — PAIR: disclose data sources (https://pair.withgoogle.com/chapter/explainability-trust/). BizDecide: every RM figure is a chip; click opens CSV rows (file, row range).
8. **Calibrated, worded confidence badge** — Kim et al. FAccT 2024 (https://arxiv.org/abs/2405.00623). BizDecide: High / Medium / "I'm not sure — check this", set by the Verifier, not percentages.
9. **Visible self-verification lane** — Anthropic "evaluator-optimizer"; Digits CEO: "LLMs… famously prone to hallucination … In accounting, that's unacceptable" (https://www.cpapracticeadvisor.com/?p=157183). BizDecide: Verifier re-adds totals, ticks each decision, catches one planted error on stage.
10. **"What I checked / what I couldn't" box** — HAX G2; winners have "Honestly named limits" (https://dev.to/jsb-securedme/what-ai-hackathon-winners-actually-have-in-common-1kla). BizDecide: "Checked: 1,240 sales rows, 38 suppliers. Not checked: cash sales outside POS; SST status assumed."
11. **Found-money counter (with footnote)** — Rocket Money "We've cancelled nearly 2.5 million subscriptions" + footnote "not been independently verified" (https://onboarding.rocketmoney.com/join); Copilot "That streaming service you forgot about? We didn't." BizDecide: "RM found this run" ticker rolls up; final figure carries a one-line basis.
12. **Time-saved counter** — Intuit "up to 12 hours" footnoted (https://investors.intuit.com/news-events/press-releases/detail/1258/...). BizDecide: "Bookkeeping hours replaced: 6.5" with basis.
13. **Loss-framed headline, gain-framed button** — Hossain & List (https://www.nber.org/papers/w15623); Fryer et al. (https://www.nber.org/papers/w18237). BizDecide: "You are losing RM 1,840/month to Supplier A overpricing" → button "Switch and keep RM 1,840".
14. **Three decisions, not a report** — Drexler, Fischer & Schoar 2014 rule-of-thumb > accounting training (https://www.aeaweb.org/articles?id=10.1257/app.6.2.1); NN/g "shift from designing interfaces to designing outcomes" (https://www.nngroup.com/articles/generative-ui/). BizDecide: exactly three cards: action + RM impact + deadline. PDF is the appendix.
15. **Deliverable builds in a side window** — Claude Artifacts "dedicated window" (https://www.anthropic.com/news/claude-3-5-sonnet); WorkBuddy results panel (https://www.workbuddy.ai/docs/workbuddy/Overview). BizDecide: PDF brief + funding pack render page-by-page while lanes run.
16. **Replay / share link** — Manus "Each session is replayable and shareable". BizDecide: "Share this run" + QR so judges scrub the run during Q&A.
17. **Autonomy dial / approval levels** — Smashing "Trust is not a binary switch; it's a spectrum"; Relevance AI L1→L4; Lindy "Nothing irreversible happens without your approval". BizDecide: "Ask me before: emailing suppliers / submitting the funding form". Default = ask.
18. **Undo + audit log** — Smashing "Action Audit & Undo"; HAX G9; Ramp "Every decision is logged". BizDecide: 24-hour Undo; audit tab lists agent, time, source rows.
19. **One actionable number** — YNAB "Age of Money" (https://support.ynab.com/en_us/ynab-glossary-a-guide-BJd80SORq.md); Credit Karma "Approval Odds", 140M members. BizDecide: "Cash runway: 23 days" atop every brief; funding matches show "Approval odds: Medium".
20. **Named agents with personality** — Shape of AI "Identifiers"; Intuit "virtual team". BizDecide: short local names, one tone rule; "Ask your CFO" speaks like a blunt, warm neighbourhood accountant.
21. **Messaging-channel delivery** — WorkBuddy schedules tasks "with results delivered through messaging platforms"; remote triggering via Slack, Telegram, Discord, WeChat (https://technode.com/2026/05/29/tencent-launches-workbuddy-productivity-ai-agent-for-global-users/); OZÉ sent dashboards "as a PDF file … on Whatsapp"; WhatsApp "7 billion voice messages" a day. BizDecide: daily 40-second voice note + 3-line text; "reply 1/2/3 to approve".
22. **Draft-then-confirm action buttons** — Lindy "Refund the duplicate", drafts "waiting" for review. BizDecide: each decision's primary button *is* the action ("Email Supplier B for quote") with the drafted email previewed.

## 3. Research: explanations, uncertainty, confirmation, framing
- Ben David, Resheff & Tron, AIES 2021 (https://arxiv.org/abs/2101.02555): real-money game; "accuracy-based explanations of the model in initial phases leads to higher adoption rates"; explanations reduce "the adoption drop upon model failure"; people paid more for AI advice with explanations.
- Han & Ko 2025, Behavioral Sciences (https://pmc.ncbi.nlm.nih.gov/articles/PMC12561693/): AI advisor got *higher* initial trust than a human; "single advisory errors resulted in substantial trust decline" (η²=0.141); "post-error explanations significantly facilitated trust recovery" — Round-3 trust rose above baseline.
- Kim et al. FAccT 2024 (https://arxiv.org/abs/2405.00623): N=404; first-person uncertainty ("I'm not sure, but…") cut over-reliance and raised accuracy; impersonal wording weaker.
- Steyvers et al., Nature MI 2025 (https://arxiv.org/abs/2401.13835): "longer explanations increased user confidence, even when the extra length did not improve answer accuracy"; calibrated wording narrows the gap.
- Vasconcelos et al. CSCW 2023 (https://arxiv.org/abs/2212.06823): explanations reduce over-reliance when they lower the effort of verifying.
- Zhang, Liao & Bellamy FAT* 2020 (https://arxiv.org/abs/2001.02114): confidence scores calibrate trust, but the human must contribute knowledge the AI lacks.
- Hossain & List; Fryer, Levitt, List & Sadoff: loss-framed incentives outperform gains. Kern & Chugh 2009 caution: loss frames increased unethical choices [VERIFY].
- Drexler, Fischer & Schoar 2014 AEJ Applied: "rule-of-thumb training significantly improved firms' financial practices" vs standard accounting training, most for lower-skill micro-entrepreneurs. Supports decisions over reports.
- Karlan et al. 2016 (https://www.nber.org/papers/w16205): "reminders will be more effective when they increase the salience of a specific expenditure" — name the specific thing.
**Design implications:** show a track record up front; a planted, explained error in the demo is a trust asset; short rationale + worded badge beats long prose; source chips make verification cheap; the interrupt should ask for what only the owner knows; loss-frame the headline, gain-frame the button, never loss-frame something the owner can't act on. No controlled "decision vs report" framing study found — treat "3 decisions" as evidence-informed.

## 4. Demo craft
- Devin (Mar 2024): plan, then real-time progress; 13.86% SWE-bench; later "Debunking Devin" video — never claim more than the demo shows.
- Manus (Mar 2025): watch window from second one; scarcity; replayable; crashed often — shareable replay is the viral asset; instability needs a fallback.
- Digits AGL (HumanX Mar 2025): CEO hallucination quote makes *verification* the headline.
- Ramp Agents (Jul 2025): a $5 latte; "escalate only the 10–15%"; admins "watch decisions stream in" — open on one tiny, concrete transaction.
- Intuit agents: "up to 12 hours", footnoted — footnote every number.
- Operator/Mariner: the pause is the drama; Mariner honesty "not always accurate and slow".
- Claude Artifacts: deliverable builds beside the chat.
**Rubrics:** AI Tinkerers × Tencent Cloud Singapore 2026 handbook (https://abu-dhabi.aitinkerers.org/hackathons/h_bKcMFTi7cB8): AI innovation 30% ("Scenario Insight & Depth of AI Utilization"), Technical 20%, **UX & Demo 25%** ("How smooth the demo is"), Business value 25%; "5-minute presentation + 3-minute Q&A"; "Live-runnable demo, with a screen recording as backup"; blurb "under 10 words"; "Quantifiable Metrics or Defined Impact". HK "Agent Creativity" Track 2 WorkBuddy (https://luma.com/agentcreativity): theme alignment, MVP completeness, innovation, "Did the team use sponsored products?". Tencent "AI CAN DO IT" SG 2026 (https://luma.com/26fqf3hy): DBS "Direct Conversational Transaction Agent" track; Aspire fintech track with "audit trail". **AI Hackerdorm 2026 rubric not found online [VERIFY].** lablab.ai: live demo at 0:30–2:30; "Judges reward clarity over production value"; local-only demo "scores as if it doesn't work"; one "golden path". Masai: write the "90-second demo script" before code; judges decide "in the first 30 seconds". YC/Kevin Hale: "Legible slides… even old people sitting in the back row with bad eyesight can read".

## 5. Finance-app "aha" patterns
Found-money ledger (Rocket Money "I found almost $50 a month that I didn't even know I was spending"); "Spot subscriptions" → "Spot leaks"; one number that moves (YNAB Age of Money); Approval odds (Credit Karma); personality (Cleo [VERIFY]).

## 6. WhatsApp-first delivery
98% open rate is a Mobilesquared *estimate*; measured ~68% read rate for opt-in broadcasts; email ~21% (https://www.go4whatsup.com/guides/whatsapp-marketing-statistics/). Say "roughly 3× email". "7 billion voice messages" a day; on-device transcripts since Nov 2024 → send voice + text. WorkBuddy delivers scheduled results to messaging apps → Track 2 story: skill runs in WorkBuddy, WorkBuddy pushes the brief to the owner's chat app.

## 7. Recommended 3-minute storyboard
- 0:00–0:10 Black slide: "Mak Cik Ros runs a kedai in Klang. Last month she overpaid RM 1,840 and didn't know." Silence, then the line. (loss frame; specific person)
- 0:10–0:25 Photo of a POS export + WorkBuddy. "No accountant. Just CSVs. Here is her month."
- 0:25–0:40 Live: drag 3 CSVs into the BizDecide skill in WorkBuddy; plan card; read plan aloud, tap Go.
- 0:40–1:20 Six lanes animate in parallel; RM counter rolling; Verifier ticks; one red "duplicate invoice — re-checking". "Six agents. Watch the Verifier — it just caught a double count."
- 1:20–1:45 Run pauses. "Needs you" card: "Supplier B: 11% cheaper, 4 days slower. Which matters this month?" QR + 6-digit code. "Ros isn't here — you are. Vote." (Mentimeter free tier "up to 50 participants"). Decision flips live; presenter's phone shows the same card on WhatsApp.
- 1:45–2:15 Three decision cards: loss headline, RM impact, "Why", confidence badge. Click one source chip → raw rows. "Checked / couldn't check" box. "Every ringgit has a receipt."
- 2:15–2:35 Right panel: PDF pages fill; funding pack prints with "You do this part" card. Ask your CFO: "Boleh bayar gaji bulan depan?" → "Yes — runway 23 days."
- 2:35–2:50 Counter freezes: "RM 4,310/month found · 6.5 h/month saved" with footnote. 8-second WhatsApp voice note plays.
- 2:50–3:00 Close: "She didn't get a report. She got three decisions and a loan application." QR to the run replay. Stop at 3:00.
**Risk mitigations:** screen recording of the identical run (Tencent handbook expects one); fixed demo seed so timings and the planted error are deterministic; cap each lane at 25 s; pre-cached run replays from local state if the API stalls; poll works offline via show-of-hands; phone hotspot; QR page preloaded on presenter's phone; one golden path; opener under 10 seconds.

## 8. Five judge objections and the pre-empting pattern
1. "It's a GPT wrapper over a CSV." → six visibly parallel lanes, Verifier catching a planted error, rationale + source chip on every number.
2. "How do I know the numbers are right?" → source chips open rows; worded confidence; "checked / couldn't check" box; the acknowledged, explained error.
3. "Owners won't act on AI advice." → interrupt asks only what the owner knows; loss headline + gain button; three rule-of-thumb decisions; daily WhatsApp voice note with reply-to-approve.
4. "Why WorkBuddy and not a web app?" → deliverables in WorkBuddy's results panel; scheduled runs push to messaging apps; custom-skill proof on screen per the Track 2 rule.
5. "Where is the business value?" → found-money and time counters with footnotes; funding pack as the monetisable outcome; one "Quantifiable Metrics" line on the close slide.

## 9. [VERIFY]
Hackerdorm rubric; a16z agentic-UX article; NN/g agent article; Tencent Yuanbao citation UI; Cleo copy; Khatabook numbers; Meta Business AI; Kern & Chugh full text; Operator leaked prompt authenticity.
