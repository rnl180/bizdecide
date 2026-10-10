# Answer key: what the agent should find in Rock Cafe

**Do not feed this file to the agent.** Use it to test the agent and to script the live demo. Everything here is fictional.

## Business at a glance

| Fact | Value | Where it comes from |
|---|---|---|
| Sector | Services (F&B kopitiam) | business_profile.json |
| Annual turnover (Oct 2025–Sep 2026) | **RM252,571.08** | sales_2025-10_to_2026-09.xlsx → Monthly!H14 |
| Full-time employees | 4 (owner excluded) | business_profile.json |
| SME class | **Micro** (turnover < RM300k AND employees < 5) | knowledge/markets/MY/sme_definition.md |
| Operating since | 15 Mar 2021 (≈ 5.5 years) | business_profile.json |
| Owner | Woman, 34, Malaysian, Bumiputera | business_profile.json |
| Seasonality to explain | Feb–Mar 2026 dip (Ramadan, ~6-day Raya closure); March RM10,740 vs ~RM22.5k normal | sales file "note" column |

## Planted finding 1: quiet supplier price creep (+12%)

Supplier **Star Coffee Trading Sdn Bhd (S01)**, item **Black Coffee Powder Blend 1kg**:

| Invoice | Date | Unit price | Change vs baseline |
|---|---|---|---|
| KCB-26-1187 | 17 Jun 2026 | RM28.00 | baseline |
| KCB-26-1194 | 1 Jul 2026 | RM28.00 | 0% |
| KCB-26-1201 | 15 Jul 2026 | RM29.10 | +3.9% |
| KCB-26-1208 | 29 Jul 2026 | RM29.10 | +3.9% |
| KCB-26-1215 | 12 Aug 2026 | RM30.20 | +7.9% |
| KCB-26-1222 | 26 Aug 2026 | RM30.20 | +7.9% |
| KCB-26-1229 | 9 Sep 2026 | RM31.36 | **+12.0%** |
| KCB-26-1236 | 23 Sep 2026 | RM31.36 | +12.0% |

- Three step increases of ~RM1.10 each, 15 Jul → 9 Sep (8 weeks). No notice: `suppliers.csv` → notified_price_change = No.
- Other items on the same invoices (tea powder RM22.50, robusta beans RM38.00) did **not** change. A good agent says the creep is item-specific, not supplier-wide inflation.
- Extra paid Jul–Sep vs RM28.00 baseline: **RM147.62**. Annualised at current price and average volume (11.25 kg/fortnight): **≈ RM983/year**.
- Expected agent action: alert + suggest asking the supplier for the reason or quoting an alternative; attach invoices KCB-26-1187 and -1229 as evidence.
- Two of these invoices exist as phone photos in `invoices/photos/` (1201 and 1229). OCR must read 29.10 and 31.36 correctly for the alert to fire.

## Planted finding 2: duplicate payment

- Invoice **LSS/2609/278** (Fresh Dairy Farm, 11 Sep 2026, **RM642.00**) was paid **twice**: 15 Sep (ref IBG0915S02) and 16 Sep (ref IBG0916S02).
- The payables ledger shows it once. Expected action: flag, draft a refund/credit-note request to the supplier.

## Planted finding 3: missing transaction

- Sales file: **18 Sep 2026 DuitNow QR sales = RM312.40**.
- Every other QR day settles T+1 as `DUITNOW QR MERCHANT SETTLEMENT ddmmyy`. **There is no settlement for 180926** (expected on 19 Sep).
- Expected action: flag as unsettled revenue, suggest raising it with the QR acquirer. A naive agent that only checks the payables ledger will miss this; it requires sales-to-bank matching.

## Planted finding 4: unclear receipt (live poll)

`invoices/2026-09-12_RECEIPT_pasaraya-serba-murah_UNCLEAR.pdf` (+ photo), paid by debit card from the **business** account (bank: POS DEBIT 12 Sep, RM144.15).

| Line | Amount | Likely |
|---|---|---|
| Sweetened Condensed Milk ×6, Fine Sugar ×5, Dish Soap ×2 | RM52.45 | Business |
| Baby diapers, toothpaste | RM51.80 | Personal |
| Fragrant Rice 10kg | RM39.90 | **Genuinely ambiguous** (staff meals vs home) |

Right answer is "split it", not business-or-personal. Expected agent behaviour: propose the split, ask the owner about the rice, and record personal items as owner drawings. Poll question for judges: "Business, personal, or both?"

## Not anomalies (agent should NOT flag)

- Bread (Golden Bakery) and LPG (Quick Gas) invoices have no bank payment: they are **cash on delivery** per suppliers.csv / payables_ledger.csv.
- Owner drawing RM1,500 on 25 Sep: legitimate, but should be classified as drawings, not expense.
- Card settlements are 1.5% below gross sales: merchant discount rate.
- Delivery payouts are 70% of gross: 30% platform commission.

## Expected funding matches (from knowledge/markets/MY/funding_db.csv, re-verified 10 Oct 2026)

| Programme | Expected result | Reason the agent should give |
|---|---|---|
| BNM SME SRF | **Strong candidate, conditional** | Micro, Malaysian. Must show "material impact" from supply-chain disruption: the supplier price-creep invoices are exactly the evidence BNM lists. Working capital only. Applications close 30 Jun 2027 (BNM FAQ, 9 Oct 2026) |
| BNM MEF / Skim Pembiayaan Mikro | **Eligible** | Micro, >6 months operating. Agent should rank banks by effective rate, not flat rate |
| TEKUN Niaga | **Eligible** | Bumiputera, age 34 (18–65), SSM-registered, existing business. RM40k goal fits the RM10,001–RM100k range |
| MARA DanaNITA (row id MARA-SEMAI) | **Likely eligible (equipment part only)** | Bumiputera woman, 18–60, ≥6 months trading; covers working capital and machines/equipment, not renovation. SEMAi itself is only for MARA-school graduates, which the data doesn't say |
| Hijrah Selangor NIAGA PLUS | **Possible** | Selangor business, ≥1 year trading. Must be a registered voter living in Selangor: agent should ask. RM50k cap is unconfirmed (secondary source) |
| MSME Digital Grant MADANI | **Not available (closed 6 Sep 2025)** | Would meet the criteria, but applications closed; no 2026 round found. Agent must not recommend applying |
| SJPP GGSM4 | **Possible** | Guarantee on a bank loan; Bumiputera focus sector → up to 80% cover |
| Agro Penjaja-i (MRP 2.0 financing) | **Likely eligible** | Micro, Malaysian, age 34 (21–70), ≥12 months trading. Join by opening an Agrobank account; financing RM1k–100k |
| AIM PADURI MADANI | **Unknown → must ask** | Needs household income ≤ RM5,880; not in the data. Correct behaviour is a question, not a guess |
| PUNB PROSPER GROW | **Not eligible (near miss)** | Needs ≥ RM300k turnover; Aminah has RM252.6k. Good demo line: "you're RM47k short" |
| CGC BizMula-i / BizWanita-i | **Not eligible** | Business must be < 4 years old; Aminah is ~5.5 years |
| BSN Madani Belia | **Not eligible** | Youth owner ≤ 30; Aminah is 34 |
| SME Bank TECHAD | **Not a fit** | RM100k minimum; tech adoption focus |
| TEKUN SPOT | **Not a fit** | For online businesses |
| BNM PTF / RAFt | **Not eligible** | Not tourism; no flood event |
| Cradle CIP Sprint / MIDA DIAF-ESG | **Not eligible** | Tech Sdn Bhd only / manufacturing & selected services |

Scoring idea for your own test run: count correct verdicts (16 rows) and whether the agent **asked** about AIM rather than guessing.

## Reconciliation numbers (for checking the agent's arithmetic)

- Opening balance 1 Sep: RM18,450.00; closing 30 Sep: **RM16,959.22**
- Total credits: RM17,297.74; total debits: RM18,788.52
- If the duplicate is recovered and the QR settlement arrives, cash would be RM642.00 + RM312.40 = **RM954.40** higher.
