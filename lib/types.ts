import { z } from "zod";
import { DEFAULT_MARKET, marketPack } from "./markets";

/**
 * The contract between the BizDecide app (data layer) and WorkBuddy (the brain).
 * The app only collects and stores these shapes. WorkBuddy reads them through
 * the MCP server, does all of the analysis, and writes a Result back.
 */

export const SERVICES = ["cfo_brief", "bookkeeping", "procurement", "funding"] as const;
export type Service = (typeof SERVICES)[number];

export const SERVICE_LABELS: Record<Service, { title: string; blurb: string }> = {
  cfo_brief: { title: "Monthly CFO brief", blurb: "The three decisions that matter most this month." },
  bookkeeping: { title: "Close my books", blurb: "Profit and loss, where the money went, what doesn't add up." },
  procurement: { title: "Check my suppliers", blurb: "Hidden price rises, cheaper alternatives, next order." },
  funding: { title: "Find me funding", blurb: "Programmes this business qualifies for today, with an application pack." },
};

export const ProfileSchema = z.object({
  market: z
    .string()
    .refine((c) => Boolean(marketPack(c)), "BizDecide doesn't cover this market yet")
    .default(DEFAULT_MARKET), // ISO country code; picks the market pack in workbuddy/knowledge/markets/
  name: z.string().min(1),
  sector: z.string().min(1), // e.g. "F&B", "Retail", "Services", "Manufacturing"
  state: z.string().optional(),
  employeesFullTime: z.number().int().nonnegative().optional(),
  ssmNumber: z.string().optional(),
  registeredSince: z.string().optional(), // YYYY-MM
  annualSalesDeclaredRm: z.number().nonnegative().optional(),
  ownershipFlags: z.array(z.string()).optional(), // e.g. ["bumiputera", "women_owned"]
  goal: z.string().optional(), // free text: "open a second outlet", "buy an espresso machine"
  language: z.enum(["en", "ms"]).optional(), // the owner's form language; the brief and chat answers use it
}).loose();
export type Profile = z.infer<typeof ProfileSchema>;

export const SaleSchema = z.object({
  period: z.string(), // YYYY-MM or YYYY-MM-DD
  amountRm: z.number(),
  channel: z.string().optional(),
}).loose(); // keeps extra columns, e.g. cashRm, duitnowQrRm, cardRm, deliveryGrossRm

export const PurchaseSchema = z.object({
  date: z.string(),
  invoiceNo: z.string().optional(),
  supplier: z.string(),
  item: z.string(),
  qty: z.number().optional(),
  unit: z.string().optional(),
  unitPriceRm: z.number().optional(),
  totalRm: z.number(),
  note: z.string().optional(),
}).loose();

export const SupplierSchema = z.object({
  name: z.string(),
  category: z.string().optional(),
  contact: z.string().optional(),
  paymentTerms: z.string().optional(),
}).loose();

export const BankTxSchema = z.object({
  date: z.string(),
  description: z.string(),
  reference: z.string().optional(),
  debitRm: z.number().optional(),
  creditRm: z.number().optional(),
  balanceRm: z.number().optional(),
});

export const PayableSchema = z.object({
  invoiceNo: z.string(),
  supplier: z.string(),
  invoiceDate: z.string().optional(),
  amountRm: z.number(),
  paidDate: z.string().optional(),
  method: z.string().optional(),
}).loose();

export const BusinessInputSchema = z.object({
  profile: ProfileSchema,
  sales: z.array(SaleSchema).default([]),
  purchases: z.array(PurchaseSchema).default([]),
  suppliers: z.array(SupplierSchema).default([]),
  bank: z.array(BankTxSchema).default([]), // bank statement lines (for sales-to-bank and payment matching)
  payables: z.array(PayableSchema).default([]), // what the owner thinks they paid
  profileExtras: z.record(z.string(), z.unknown()).optional(), // owner details etc. that the form doesn't ask
});
export type BusinessInput = z.infer<typeof BusinessInputSchema>;

export type RequestStatus = "submitted" | "processing" | "waiting_for_user" | "completed" | "failed";

export interface ProgressEntry {
  at: string;
  step: string; // short label shown in the app, e.g. "Classifying SME category"
  detail?: string;
}

export interface RequestDoc {
  id: string;
  businessId: string;
  businessName: string;
  service: Service;
  market?: string; // profile.market at submission; picks the market pack (currency, rules)
  language?: "en" | "ms"; // profile.language at submission; the brief page opens in it
  status: RequestStatus;
  createdAt: string;
  updatedAt: string;
  progress: ProgressEntry[];
  error?: string;
}

export interface QuestionDoc {
  id: string;
  requestId: string;
  question: string;
  context?: string;
  options: string[];
  allowOther: boolean;
  defaultOption?: string;
  status: "open" | "answered" | "expired";
  answer?: string;
  otherText?: string;
  createdAt: string;
  answeredAt?: string;
}

/** What WorkBuddy delivers. Every decision must carry its evidence. */
export const DecisionSchema = z.object({
  priority: z.enum(["urgent", "important", "opportunity"]),
  title: z.string().min(1), // "Switch your milk supplier"
  action: z.string().min(1), // what to do, in one sentence
  impactRm: z.number().optional(), // estimated RM impact (positive = saving or gain); what kind is in impactType
  impactType: z.enum(["monthly", "one_off", "financing"]).optional(), // monthly saving/gain, one-off amount, or funding you can raise
  reason: z.string().min(1), // why, with the numbers
  evidence: z
    .array(z.object({ label: z.string(), detail: z.string().optional(), url: z.string().optional() }))
    .default([]),
  cta: z.string().optional(), // button text, e.g. "Draft the order", "Start application"
});
export type Decision = z.infer<typeof DecisionSchema>;

export const ResultSchema = z.object({
  headline: z.string().min(1), // one-line verdict on the business this period
  period: z.string().optional(),
  smeCategory: z.string().optional(), // "Micro", "Small", "Medium" with sector
  keyNumbers: z
    .array(z.object({ label: z.string(), value: z.string(), note: z.string().optional() }))
    .max(4)
    .default([]),
  decisions: z.array(DecisionSchema).min(1).max(5),
  assumptions: z.array(z.string()).default([]),
  verification: z
    .array(z.object({ check: z.string(), passed: z.boolean(), detail: z.string().optional() }))
    .default([]),
  agentsUsed: z.array(z.string()).default([]),
  reportUrl: z.string().optional(),
  applicationPacks: z.array(z.lazy(() => ApplicationPackSchema)).max(3).default([]),
});
export type Result = z.infer<typeof ResultSchema>;

/** Funding application pack: what the owner needs to apply to one programme, built from data we already hold. */
export const ApplicationPackSchema = z.object({
  programId: z.string(), // funding_db id, e.g. "TEKUN-NIAGA"
  programName: z.string(),
  agency: z.string().optional(),
  verdict: z.enum(["eligible", "conditional", "need_info"]),
  verdictNote: z.string().optional(), // the condition or missing fact, e.g. "Must show supply-chain impact"
  amountRm: z.number().optional(), // suggested amount to apply for, in the market's currency
  purpose: z.string().optional(), // "Kitchen renovation and a second kopi urn line"
  monthlyRepaymentRm: z.number().optional(), // estimate; omit for grants
  affordability: z.string().optional(), // "RM760/month = 18% of average net profit (guideline ≤ 30%)"
  prefilled: z.array(z.object({ label: z.string(), value: z.string() })).default([]), // answers for the application form
  checklist: z
    .array(
      z.object({
        item: z.string(), // "6 months of bank statements"
        status: z.enum(["ready", "partial", "missing"]),
        detail: z.string().optional(), // "We have Sep 2026 only; download Apr–Aug from your bank app"
      }),
    )
    .default([]),
  nextSteps: z.array(z.string()).default([]),
  howToApply: z.string().optional(),
  sourceUrl: z.string().optional(), // official programme page
  unverified: z.boolean().optional(), // true when the programme row is still marked VERIFY
});
export type ApplicationPack = z.infer<typeof ApplicationPackSchema>;

/** Follow-up question the owner asks on the brief page; the on-duty WorkBuddy agent answers it. */
export interface ChatMessageDoc {
  id: string;
  requestId: string;
  businessId: string;
  question: string;
  status: "open" | "claimed" | "answered";
  answer?: string;
  evidence?: { label: string; detail?: string; url?: string }[];
  createdAt: string;
  claimedAt?: string;
  answeredAt?: string;
}

/**
 * "Approve & act": the owner approves one decision on the brief page, the on-duty WorkBuddy agent carries it out
 * (writes the refund request, supplier email or funding application, saves it as a Gmail draft when Gmail is
 * connected) and reports back with complete_action. Nothing is ever sent without the owner.
 */
export type ActionStatus = "queued" | "working" | "done" | "failed";

export interface ActionEmail {
  to?: string;
  cc?: string;
  subject: string;
  body: string;
}

export interface ActionDocument {
  title: string;
  sections: { heading: string; body: string }[];
}

export interface ActionDoc {
  id: string;
  requestId: string;
  businessId: string;
  decisionIndex: number; // index into result.decisions as delivered (not the sorted order on screen)
  decisionTitle: string;
  lang: "en" | "ms"; // language the agent writes in
  status: ActionStatus;
  createdAt: string;
  claimedAt?: string;
  completedAt?: string;
  // Filled in by the agent (complete_action)
  summary?: string; // one line: "Refund request saved to your Gmail drafts"
  channel?: "gmail_draft" | "document" | "note"; // where the result lives
  email?: ActionEmail;
  document?: ActionDocument;
  links?: { label: string; url: string }[];
  error?: string; // why it failed (status "failed")
}
