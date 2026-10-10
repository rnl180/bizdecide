import type { Metadata } from "next";
import { PrivacyNotice } from "@/components/PrivacyNotice";

export const metadata: Metadata = {
  title: "Privacy notice · BizDecide",
  description: "What BizDecide collects, why, who processes it and who can see your brief.",
};

export default function Page() {
  return <PrivacyNotice />;
}
