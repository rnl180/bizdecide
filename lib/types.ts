import { z } from "zod";

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
  funding: { title: "Find me funding", blurb: "Malaysian programmes this business qualifies for today." },
};

export const ProfileSchema = z.object({
  name: z.string().min(1),
  sector: z.string().min(1), // e.g. "F&B", "Retail", "Services", "Manufacturing"
  state: z.string().optional(),
  employeesFullTime: z.number().int().nonnegative().optional(),
  ssmNumber: z.string().optional(),
  registeredSince: z.string().optional(), // YYYY-MM
  annualSalesDeclaredRm: z.number().nonnegative().optional(),
  ownershipFlags: z.array(z.string()).optional(), // e.g. ["bumiputera", "women_owned"]
  goal: z.string().optional(), // free text: "open a second outlet", "buy an espresso machine"
});
export type Profile = z.infer<typeof ProfileSchema>;

export const SaleSchema = z.object({
  period: z.string(), // YYYY-MM or YYYY-MM-DD
  amountRm: z.number(),
  channel: z.string().optional(),
});

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
});

export const SupplierSchema = z.object({
  name: z.string(),
  category: z.string().optional(),
  contact: z.string().optional(),
  paymentTerms: z.string().optional(),
});

export const BusinessInputSchema = z.object({
  profile: ProfileSchema,
  sales: z.array(SaleSchema).default([]),
  purchases: z.array(PurchaseSchema).default([]),
  suppliers: z.array(SupplierSchema).default([]),
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
  impactRm: z.number().optional(), // estimated monthly RM impact (positive = saving or gain)
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
});
export type Result = z.infer<typeof ResultSchema>;
