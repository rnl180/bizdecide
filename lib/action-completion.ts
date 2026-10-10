import type { ActionDoc, Decision } from "./types";
import { impactKind } from "./impact";

export type ActionCompletion = Pick<ActionDoc, "status" | "summary" | "channel" | "email" | "document" | "links" | "error">;

/** Returned to WorkBuddy as a tool error so it can repair the output and try again. */
export class ActionCompletionError extends Error {}

export function actionCompletionProblem(out: ActionCompletion, decision?: Decision): string | null {
  if (out.status === "failed") {
    return out.error?.trim() || out.summary?.trim() ? null : "Explain why the action failed in error or summary.";
  }
  if (out.status !== "done") return "Complete an action with status done or failed.";
  if (!out.summary?.trim()) return "Add a short summary of what is ready for the owner.";

  const email = out.email;
  if (email && (!email.subject.trim() || !email.body.trim())) return "The email needs a subject and body with actual text.";
  const document = out.document;
  if (document && (!document.title.trim() || !document.sections.length || document.sections.some((s) => !s.heading.trim() || !s.body.trim()))) {
    return "The document needs a title and at least one section, with text in every heading and body.";
  }
  if (!email && !document) return "Attach the completed email or document before marking this action done. A summary or links alone are not a deliverable.";
  if (decision && impactKind(decision) === "one_off" && !email) return "Attach the refund or settlement query email promised to the owner.";
  if (out.channel === "gmail_draft" && !email) return "Include the email saved as a Gmail draft.";
  if (out.channel === "document" && !document) return "Include the document for channel document.";
  return null;
}
