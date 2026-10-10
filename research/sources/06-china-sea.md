# AI-finance tools SMEs love in China + SEA (and what to steal for the WorkBuddy demo)
10 Oct 2026. [V] vendor, [3P] third-party, [R] user review, [I] inference, [VERIFY] unreachable.

## 1. Five things that matter most
1. **Judges' home turf = agent orchestration + WeCom.** WorkBuddy launched 9 Mar 2026, 13M DAU in 3 months, ships 专家团队 (expert teams), 项目空间 (multi-agent project spaces), 70k+ SkillHub skills, MCP, 1-minute WeCom/WeChat remote control (https://www.qbitai.com/2026/06/430758.html; https://cloud.tencent.com/product/workbuddy). BizDecide's "team of agents that verifies its own work" maps onto Tencent's vocabulary.
2. **China's best-loved SME finance AI is diagnosis → attribution → action, not dashboards.** Meituan 袋鼠管家 returns "从诊断、归因到行动建议的完整结果"; a merchant called 智能掌柜 "a business health check-up" (经营上的体检报告) (https://www.chinanews.com.cn/cj/2026/06-26/10647834.shtml). Chanjet's AI好生意 ships six named "digital employees" incl. an *Inspector* that flags cost/price/cash anomalies (https://stock.10jqka.com.cn/20260818/c679054557.shtml).
3. **"Self-proof" lending from the owner's own evidence.** MYbank 百灵: merchants prove credit with "合同、发票、店铺照片"; bank's stated goal "让小微企业拥有AI CFO" (https://news.ifeng.com/c/8kTqw6lGavE). WeBank 微业贷: 6M+ applicants, "最快1分钟到账" (https://news.pedaily.cn/20260112/121928.shtml).
4. **Policy matching is a solved UX in China: type company name → matched subsidies → one-click apply in 3 minutes**, red/green/grey policy calendar (https://www.sz.gov.cn/szzt2010/jjhlwzwfw/cxal/content/post_11042540.html). Vietnam's MISA Lending: 2-min application, ~1-day decision from accounting data (https://lending.misa.vn/).
5. **SEA's lovable features are humbler: WhatsApp/LINE delivery, free tier, a human.** BukuWarung "Tagih" sends debt reminders over WhatsApp (https://bukuwarung.com/); PEAK alerts via LINE (https://peakaccount.com/); FlowAccount and Jaz expose MCP/Claude connectors.

## 2. China — depth
### 2.1 Tencent WorkBuddy
- "AI原生桌面智能体工作台"; beta 6 Feb, GA 9 Mar 2026, WeChat/WeCom direct-connect 12 Mar, Enterprise + Agent Suite 5 Jun, mobile app 18 Jul (https://www.ithome.com/0/927/230.htm). 20M MAU / 13M+ DAU at ~3 months; SaaS seat ¥78→¥198/user/month [unverified] (https://www.itiger.com/hans/news/2654008710). Q2 2026: task solve-rate 72%→90%, 50+ industries, "可以调用微信与企业微信" (https://cn.chinadaily.com.cn/a/202608/14/WS6a7eaef3a310099e0fc7bbf7.html).
- Primitives judges listen for: 领域专家 (100+ preset; upload SOP to build your own), 云端助理 (keeps running after client closes), 项目空间 (parallel subtasks, results merge), SkillHub "7万+ Skills", 连接器, OpenClaw-skill compatibility, MCP. Enterprise: 数字员工, admin console with cost tracking; "Buddy AI 生态共创计划" partners incl. Ping An Bank and Meituan.
- What Tencent values: "企业选择智能体产品，最在意的从来不是成本，而是可信、可控" (https://news.qq.com/rain/a/20260727A032W100). Meituan's 王莆中: AI advice must be "可审计、可复盘" (https://www.36kr.com/p/3512515121077381).
- Complaints: third-party 70-question test 2.31/4; "偶有报错重试和卡顿". No finance showcases/hackathons found [VERIFY].
### 2.2 Tencent Cloud ClawPro × 慧算账 — accounting agent in the WeCom sidebar (Apr 2026)
- Bookkeeping firm 慧算账 embedded Tencent Cloud's "龙虾助理" (ClawPro) in the **企业微信 sidebar**: while chatting with a client, the accountant runs 社保查询、发票查验、账务调整、税务报表生成 and triggers batch tax-filing RPA. Capacity per accountant ~300 → 400–500 firms, "效率提升超过50%". Founder: "让一个专业会计带着N个龙虾助理去工作" (https://www.yzwb.net/news/ch/202604/t20260429_347586.html). ClawPro adds private Skill platform, Agent Memory Pro, per-employee **token-consumption dashboard**. The one public Tencent-ecosystem finance agent.
### 2.3 Kingdee 金蝶AI星辰
- Micro/small; ~¥3,000/yr entry; 15-day trial. 老板参谋: natural-language questions over 65+ indicators → chart; 经营报告 "每日、每周、每月自动推送"; 语音开单; proactive restock/expiry/churn alerts framed as "数据找人" (https://m.tech.china.com/hea/articles/20260319/202603191828414.html). App Store: AI answers "why did profit fall, which customers to chase". Wow: "像聊天一样问系统" + bakery 潘祥记 finding ¥10M+ dead stock. Complaints: 4.2/5 (227), login spinning, crashes, "鸡肋"; no review mentions AI. CEO: "每一个企业都需要一个超级管理智能体".
### 2.4 Chanjet 畅捷通 — 畅龙虾 + AI好生意
- 畅龙虾 (Q1 2026): LLM brain + skills hands; natural-language 查询/填报/对账. AI好生意 (18 Aug 2026): 智能录单, 自动对账核销, **24小时语音问数**, dormant-customer flagging, six AI staff — Promoter, Order Clerk, Accountant, Analyst, Assistant, **Inspector (flags cost, price, cash anomalies)**. Slogan "会做业务就会用AI".
### 2.5 Meituan merchant AI — closest to "3 decisions with evidence"
- 袋鼠管家 (delivery), 智能掌柜 (dine-in; 1.3M restaurants, 8.6M problems solved), 袋鼠参谋 (site/pricing, invite-only; "Token确实很贵"), CatPaw AI工作台 with "行业智能体专家团". **Free for SMEs.** Delivery: chat Q&A ("which dish gets most bad reviews?"), one-click 日报/周报, auto-inspections with push alerts, **同行对比 (peer comparison) inside 智能掌柜**, trade-area report; 袋鼠管家 tracks action→data effect (closed loop) (https://stock.10jqka.com.cn/20260909/c679754940.shtml). Merchant quotes: "这种程度的数据分析，以前只有大连锁才能做到" (this level of analysis, only big chains could do before); "智能掌柜就是经营上的体检报告".
### 2.6 MYbank 网商银行 — 310, 百灵, 大雁, 布谷鸟
- 310: "3分钟申请、1秒钟放款、0人工干预"; data = Taobao/Alipay flows, QR receipt patterns, logistics, satellite imagery; cost per loan ≈ ¥2.3 vs ~¥2,000 (https://www.woshipm.com/pd/6333617.html). 百灵 (2023): conversational AI credit officer; upload 门头/货架 photos, contracts, invoices to "自证"; 8M+ served, avg uplift ¥45k. 大雁: supply-chain graph; "原来是经销商找钱，现在是钱来找经销商" (https://www.36kr.com/p/1467582071573254). 布谷鸟 (2024): forecasts merchant cash flow.
### 2.7 WeBank 微众银行 微业贷 (Tencent-affiliated)
- Unsecured, 7×24; 6M+ applied, 1.7M+ credit lines (Jun 2025); NPL ~1%; >60% first-time bank borrowers; "最快1分钟到账" (https://apps.apple.com/cn/app/id1455485724). App 3.6/5. **Counter-signal:** in 2026 Chinese banks moved tax-data loans from full auto-approval to "线上申请+线下复核" after fraud/packaging and rising NPLs; regulators push multi-source cross-validation (https://news.10jqka.com.cn/20260718/c678265092.shtml) → BizDecide's self-verification/evidence trail is a selling point.
### 2.8 Policy/subsidy matching — Shenzhen Longhua 政策AI计算器
- Enter company name → AI matches subsidies → "一键申报"; **policy calendar green/red/grey**; 3 min vs ≥30; ¥1.2B issued, 2,000+ firms (sz.gov.cn above). Beijing Changping 2025: WeChat mini-program "政策计算器" to *estimate the yuan amount* (https://www.beijing.gov.cn/hudong/gfxwjzj/qjzjxx/202502/P020250211388761273085.docx). Provincial "企业—政策双向标签".
### 2.9 1688 procurement intelligence
- Free "AI数字员工" four roles incl. 经营管理, "from execution layer to decision layer"; AI找厂; "AI参谋" with 定价建议 (https://www.qbitai.com/2025/09/335835.html). Price-anomaly rule: quote >30% below peers auto-frozen. OpenClaw skill "1688-price-monitor" parses a link → wholesale price, MOQ, factory age, repurchase rate, margin estimate (https://getclawkit.com/skills/official-275254cl-hash-1688-price-monitor); another generates a 30-day merchant "intelligent diagnosis report". WorkBuddy is OpenClaw-skill compatible.
### 2.10 Quick hits
- 柠檬云 (free + upsell, 5M users): upload bank slip/invoice *or say it aloud* → voucher in ~10s; "1人能轻松代账200家".
- 度小满 AI经营助手 (free, Sep 2025): 智能记账本 merges business flows and personal accounts into one daily view (https://www.yzwb.net/news/ch/202509/t20250901_257992.html).
- 钉钉 AI创业助理 (Aug 2025): for "一人公司": AI drafts 财税/法务, humans "兜底".
- 飞书多维表格 AI: one-click chart interpretation + anomaly detection; subscribe to periodic AI dashboard summaries.
- 微信小店助手 (Tencent): gamified 经营分 — but **2.3/5 (684)**; "客服就是一群机器人". Gamification is fragile.

## 3. Southeast Asia
- **MISA (Vietnam)** — closest SEA analogue: AVA "Trợ lý AI đồng hành cùng CEO 24/7" analyses revenue/cost/profit, flags bottlenecks, suggests remedies; 400k+ businesses (https://amis.misa.vn/). **MISA Lending**: with consent, analyses ledger data to suggest packages; 2-min form, ~1-day decision, no collateral; "fastest and most effective credit source in 13 years". Wow: a "Vay vốn" (borrow) tab inside the ledger.
- **Mekari Jurnal + Airene (ID)**: report analysis → tables + summaries, "wawasan deskriptif" and "rekomendasi"; 35k+ businesses (https://mekari.com/produk/airene/). No WhatsApp delivery.
- **Jaz (SG)**: drop PDFs/zips → itemised, categorised, ready to approve; 98% auto-match bank rec; Claude connector + open API; "Start for Free" (https://www.jaz.ai/).
- **Aspire (SG)**: 50k+ businesses; MCP; "$111,000 and 900 hours per year" saved (Endowus). **FlowAccount (TH)**: free tier, ฿165/mo; 160k+; MCP in all plans. **PEAK (TH)**: free tier; 30k+; "@PEAK Connect" alerts via LINE; PEAK Board P&L by project/branch.
- **Osome** S$75/mo; 4.2/5 (1,012); "everything was up and running within a day". **Counto**: status tracker with progress bars + pending-task alerts, CSM on WhatsApp (https://www.counto.sg/). Sleek: no AI.
- **Malaysia POS**: **Feedme (feedme.ai)**: "REMY — a data storyteller and strategic advisor"; 10k+ merchants; "reduced headcount costs by 20%" (https://feedme.ai/). **StoreHub**: RM122/235/471 per month; 20k+ businesses; 4.7/5 (2,200+ Google reviews); "actionable sales reports"; no AI/daily WhatsApp report claimed (https://www.storehub.com/my/pricing/). Boost merchant cash advance [VERIFY].
- **Indonesia**: BukuWarung 8M+ users; "Tagih" WhatsApp payment requests; loans to Rp50M; "Talangin Dulu" stock BNPL. Moka Rp299k/outlet; "analysis by time, including busiest hours". Majoo 30+ reports + majoo Capital. Kledo free-forever, 75k+.
- **Lending from data**: Funding Societies MY RM15B, micro financing "within 5 days"; CapBay RM6.1B; First Circle PH loan in 1 day, 4.9/5; Modalku: good statements and sales records "are enough to get a business loan".

## 4. Patterns: what Chinese/SEA SMEs love
1. "数据找人" (data finds the person) — push daily/weekly summaries and anomaly alerts; nobody praises a dashboard.
2. Owner's dialect: voice in, chart out.
3. Diagnosis → attribution → action, with the action tracked (closed loop).
4. Peer context (同行对比); strongest merchant quote is about parity with big chains.
5. Self-proof credit; speed is the headline ("1 minute", "1 day", "3 minutes").
6. Zero-input via platform data — but 2026 backlash (tax-data models gamed; human checks re-added). Evidence trails win.
7. Channel-native delivery (WeCom sidebar, LINE, WhatsApp).
8. Free tier + human backstop (兜底).
9. Gamification is fragile.
10. Auditable AI is the enterprise ask.

## 5. Ideas for BizDecide (each ≤3 min)
1. **"Body-check report" framing**: 3 red flags, each with attribution + action + RM impact (Meituan).
2. **Inspector agent** that hunts cost/price/cash anomalies and must sign off; rejects a draft live ("only 2 invoices — insufficient") (Chanjet; WorkBuddy 项目空间; "可信、可控").
3. **Peer line on every chart** (Meituan 同行对比); seed anonymised benchmarks for 5 micro-sectors.
4. **Self-proof funding pack**: snap shop front + shelves + 3 invoices → application (MYbank 百灵); contractor photographs site + 3 POs → TEKUN/SME Bank PDF in 60s.
5. **"Ringgit calculator" for schemes** + red/green/grey deadline calendar (Longhua/Changping): type SSM number → 4 schemes, "est. RM25k" + calendar.
6. **Loan-readiness score inside the ledger** with "what to fix" (MISA Lending, WeBank): "2 months of consistent QR receipts from eligibility".
7. **Supplier price-watch Skill**: purchase CSV → per-supplier price index → alert >X% vs 90-day median/peers; publish as OpenClaw-compatible Skill on SkillHub.
8. **Daily voice 经营日报 to WhatsApp/WeCom**: 20-sec BM voice note at 9pm (Kingdee push; Feishu subscribed summaries).
9. **"Ask your CFO" in the WeCom side panel** (慧算账 × ClawPro): judge types "boleh naik gaji staff RM300?" → cash-flow evidence.
10. **Action tracking loop**: decision accepted → next upload reports "did it work?" ("Decision 1 delivered +RM860 vs forecast RM1,140") (Meituan 袋鼠管家; "可审计、可复盘").
11. **Mixed personal/business tolerance** via poll ("RM400 to 'Mak' — family or supplier?") (度小满).
12. **Token/cost meter per run** ("This brief cost 0.4 credits") (ClawPro dashboard).
13. **Humans 兜底 toggle**: handoff to mock bank officer with pack (DingTalk; Osome/Counto; mirrors Ping An Bank partnership).
14. **Export as Skill/MCP server** (`bizdecide-cfo` MCP run from WorkBuddy) (FlowAccount, Jaz).

## 6. WorkBuddy showcases and what Tencent rewards
- Rewarded primitives: 项目空间 multi-agent, reusable 专家 (upload SOP), Skills on SkillHub (OpenClaw-compatible), MCP/连接器, WeCom/WeChat remote triggering, cloud 数字员工, admin cost/audit console.
- Stated values: "可信、可控" (trustworthy, controllable), observable/auditable for finance; first batch to pass 信通院 agent-security evaluation; SkillHub 35k skills in April.
- Ecosystem: "Buddy AI 生态共创计划" (Ping An Bank, Meituan, China Mobile, Ctrip, ZTE); 湾擎·WorkBuddy for Guangdong civil servants.
- **No public WorkBuddy hackathon or finance-agent showcase found** [VERIFY] → register anomaly-watch and policy-match as SkillHub Skills and show a WeCom-triggered run; you'd be the finance showcase.

## 7. [VERIFY]
GoBusiness e-Adviser (403); MYbank "新310" (404); WeChat Pay "经营数据推送"; 企查查/天眼查 policy matching; Boost Credit underwriting; WorkBuddy hackathons; 1688 buyer-side price-trend; 抖音来客.
