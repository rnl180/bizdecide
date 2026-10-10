import type { Metadata } from "next";
import { MyRequestsPage } from "@/components/MyRequests";

export const metadata: Metadata = {
  title: "My requests · BizDecide",
  description: "The BizDecide requests you've sent or opened on this device.",
};

export default function Page() {
  return <MyRequestsPage />;
}
