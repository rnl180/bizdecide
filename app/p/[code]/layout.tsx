import type { Metadata } from "next";

export const metadata: Metadata = { title: "BizDecide · Vote / Undi", robots: { index: false } };

export default function PollLayout({ children }: { children: React.ReactNode }) {
  return children;
}
