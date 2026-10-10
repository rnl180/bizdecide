# BizDecide UI/UX review against Mobbin

October 2026. About 60 Mobbin searches (screens, flows and website sections, web and iOS) across four areas: the landing page, upload and financing flows, the agents at work, and the brief. Links go to the Mobbin screens the patterns came from.

## What shipped in this round

| Area | Change | Pattern it follows |
|---|---|---|
| Brief | Sticky section bar (Summary, Decisions, Funding, Ask your CFO, How we checked) that marks the section you are reading | Report contents rails: [Codecademy](https://mobbin.com/screens/4685acfd-ce18-451f-8621-3b9958dda6ae), [GetYourGuide](https://mobbin.com/screens/fa287971-5bec-46e6-9845-f398d4ba85c9) |
| Brief | "Mark as done" on each decision, an "x of 3 done" meter, ticked rows struck through in At a glance (saved in the browser only) | [Monarch advice](https://mobbin.com/screens/53631102-dc15-414f-92b8-e6802620d214), [Origin onboarding](https://mobbin.com/screens/912394f8-c88e-455b-8018-24a8196761d3), [Google Workspace](https://mobbin.com/screens/05a829a2-525b-4a6e-911a-f4d5e2e5b9ce), [Pipedrive](https://mobbin.com/screens/c1795eb0-a714-4c8c-8108-b3f18c8faee1) |
| Brief | "8 of 8 checks passed" chip in the brief header, linking to the checks | [Square](https://mobbin.com/screens/fd16b917-b38a-4707-ae9c-8f21fc0c2817), [Remote](https://mobbin.com/screens/404d79e7-de8c-45e4-8c9f-0deae9c090d4) |
| Brief | Evidence folds on phones ("Evidence 2"), stays open on desktop, opens for printing | [Copilot drill-down](https://mobbin.com/flows/487aa120-1b3b-49dc-969e-7892b9749096), [DoorDash Merchant](https://mobbin.com/screens/942026ed-65a8-43a2-9233-e2d3f0d177d4) |
| Funding pack | Document checklist sorted missing, then partial, then ready | [Turo](https://mobbin.com/screens/735b3b29-a44f-4f3f-87ec-c7b7ccc56b0c), [Revolut Business](https://mobbin.com/screens/874b18b7-720b-45eb-aeee-3ad124804e1f) |
| Request page | Ticking "Elapsed 02:36" clock on the status card and "4 steps done" on the activity list | [Rox](https://mobbin.com/screens/107c729c-a68d-48e3-8ece-51d43eff4215), [Browserbase run](https://mobbin.com/flows/49b39051-8e71-4087-b67b-f00a583bc6c7), [Relevance AI](https://mobbin.com/screens/4c9ec795-7b0a-481b-b823-bb8110a8d09c) |
| Agent question | The answer the agents will assume is tagged "Our assumption" on the option itself | [Cofounder](https://mobbin.com/screens/52d55c74-ed5e-4f4f-adbf-40715cb4bb66), [Unify](https://mobbin.com/screens/66df7194-18ef-479e-9679-03955deba055) |
| Landing | FAQ (7 questions: what to upload, who sees the numbers, does it send anything, accuracy, loan approval, languages, deleting data), English and BM, answers taken from the privacy notice and existing copy | [Sana](https://mobbin.com/sites/sections/5738797a-e33d-470c-b1cf-800711953fef), [Granola](https://mobbin.com/sites/sections/95721d27-ef7f-4c76-8e65-c1cf5585ff81), [Goldsand](https://mobbin.com/sites/sections/defc10c7-4230-4723-a0f0-afbdd5151c99) |
| Landing, phones | "Drop your files" button follows the reader after the hero and hides once the form is on screen | Landing research; no mobile-web example on Mobbin, closest is [Jeton](https://mobbin.com/sites/sections/091299d9-899c-4a1b-9759-4892aadd2a99) |
| Upload form | Bottom bar once files are in: "6 files ready to send · Rock Cafe" and "Review and send", hidden while the send card is on screen | [Xero import footer](https://mobbin.com/screens/f3d3aee0-dca1-4968-afc6-7394eb3465ba), [Chatbase](https://mobbin.com/screens/2690363e-5752-4d08-aa03-6ad2dbc42f27) |
| Upload form, phones | "Take a photo of an invoice or receipt" opens the camera | [Alan](https://mobbin.com/screens/567326d5-369b-4876-90fd-d2b46a0410af), [Fi](https://mobbin.com/screens/85873190-10ce-4079-8267-c09316bfb393) |
| Every page | Language switcher in the footer (each language named in itself), skip-to-content link | [Notion footer](https://mobbin.com/sites/sections/74cc2f3a-63f5-4f62-a29c-4c5ae5869894) |

New Bahasa Melayu strings (FAQ, section bar, done meter, camera, bottom bar) follow the existing translations but have not been checked by a native speaker. The brand guide asks for that before release.

## Proposed next, for approval

Effort: S is under half a day, M is one to two days, L is three days or more. "Backend" means it needs agent or API changes, not just UI.

1. **Editable draft with rewrite chips (M, backend).** Make To, Subject and body editable in place after Approve, with Shorter, More formal and Bahasa Melayu chips and an undo. Seen in [Rox](https://mobbin.com/flows/1065674a-c481-4ca9-8f66-785dc2a33559) and [Superhuman](https://mobbin.com/flows/e81168d3-1735-4364-9914-717fc39b4fb4).
2. **Before / now rows for price rises and double payments (S–M, backend).** Agents return structured old price, new price and difference, and the evidence shows three rows with a red up arrow instead of prose. Seen in [Peerspace](https://mobbin.com/screens/28471a72-c525-4aa1-ad10-766ecc730cd5) and [Orbit](https://mobbin.com/screens/f5aee086-c46d-41db-8fc1-aee8319a38fa).
3. **Real counts while the agents work (M, backend).** Progress rows say "Read 1,240 sales" or "Matched 38 invoices", each tagged with the agent's name. Seen in [Elicit](https://mobbin.com/screens/232b3136-ccbb-42e7-a45c-412ea436f330) and [StackAI](https://mobbin.com/flows/ccd6c5b7-03d6-497e-bff6-bb262fd8ee64).
4. **Failures that name the agent, the file and the fix (M, backend).** For example "Bookkeeper couldn't read page 3 of maybank_mar.pdf (scanned image)", with Retry, Upload a clearer file and Continue without it. Seen in [Zapier](https://mobbin.com/screens/f1f5e66a-038c-4e1a-b5e8-2a1126467840) and [n8n](https://mobbin.com/screens/f70fc619-d6bf-4dff-958d-ef47afc0342e).
5. **"Email me when the brief is ready" (M, backend).** It needs an email sender and the owner's address, which BizDecide doesn't collect today. Seen in [Claude iOS](https://mobbin.com/screens/795e1600-cad6-4f17-ab49-2dde0f004836) and [Codex](https://mobbin.com/screens/3ad97d8d-f703-4ad0-b34f-6d1c8897f96c).
6. **Per-file read status and skipped rows (M).** Rows that move through Reading, Read, Needs help and Can't read, with "12 rows skipped: no amount" and a plain-words reason. Seen in [Customer.io](https://mobbin.com/screens/029db142-f127-46bb-817f-a802abc68783), [Monarch](https://mobbin.com/screens/d5db05d1-8f27-483c-9f1e-24ad94912623) and [Square](https://mobbin.com/screens/a13e0b6c-1806-4f5c-a390-956c0fe93ad5).
7. **Funding criteria with Met / Needs work badges (M, backend).** The pack lists each programme rule with evidence from the owner's own numbers. Seen in [Square Loans](https://mobbin.com/flows/1b666116-0bf2-4a03-9f9f-4fea564dbffa).
8. **Repayment term chips (S).** Tenure chips under the suggested amount that recalculate the monthly repayment, with the rate and term shown as assumption pills. Seen in [Shopee](https://mobbin.com/screens/13b87655-a6ca-4077-9645-b798e6b9bfc8) and [ANZ Plus](https://mobbin.com/screens/169dbf6e-afa7-4ca1-9042-edc75d3f866b).
9. **Sample brief as a demo mode (M).** "See it on a sample kopitiam" opens a finished sample brief with a "Sample · Use my files" strip, instead of filling the form. It needs a fixed sample result shipped with the app. Seen in [Mercury](https://mobbin.com/sites/sections/254b0eb2-65c8-440f-b3e3-a80cfd51012e).
10. **Stat tiles with period captions and a revenue-versus-costs bar (S–M).** It needs the key numbers to come back as structured values rather than strings. Seen in [QuickBooks](https://mobbin.com/screens/a1576a19-53f6-498d-80a7-02ece64072d8) and [Xero Analytics](https://mobbin.com/screens/c20aa549-ffe7-4507-88c0-f74359e12a37).
11. **Evidence chips in Ask your CFO answers (S).** Something like "Based on 3 invoices", expanding to the lines used, plus fresh follow-up chips after each answer, one of which is an action. Seen in [Dropbox Dash](https://mobbin.com/screens/fc54be30-29ff-430c-9554-7858c47373e8) and [Expensify Concierge](https://mobbin.com/screens/c45fb48a-6ae5-4f3c-86ec-8172a80eb15b).
12. **Landing order (S).** Move the four sourced statistics up under the hero as a slim strip, then the ChatGPT comparison, then How it works. Merge the dark call-to-action band into the upload form so the last button doesn't just scroll a few pixels. Seen in [Circle](https://mobbin.com/sites/sections/6756cd25-15bc-4557-8bc4-334122d8339c) and [V7](https://mobbin.com/sites/sections/ebdc7452-b179-4288-a782-391f03a2e913).
13. **Consent split into required and optional (S).** One required tick for preparing the brief, with what is read, where it is processed and how long it is kept written out next to it. Seen in [Monzo](https://mobbin.com/screens/ae9c6069-35d6-4377-9573-a9b3fb1f633b) and [ANZ Plus](https://mobbin.com/screens/9edc9609-f246-4083-9440-9e67e9031a88).

## Patterns to avoid

- Joke loading text such as "Passing the Turing test" ([Lindy](https://mobbin.com/screens/9f4affd5-f387-4149-860e-95c83f9bbba5)). When money is involved, name the real step.
- Bare error codes with no next step ([Jasper](https://mobbin.com/screens/795e06d2-f37b-43e0-b07c-5f79a23abced)).
- Reusing the agent-question card for anything that isn't a real question ([Emergent](https://mobbin.com/screens/821ee5aa-8dbc-4885-ac84-265a17a7cc9b) uses it to sell credits).
- A grey "AI can make mistakes" footer in place of evidence ([Midday](https://mobbin.com/screens/30ba6439-a7e3-4b60-9e0a-744bdbab1234)).
- Testimonials or customer logos BizDecide doesn't have. The honest stand-in is the sample brief.
