import type { Metadata, Viewport } from "next";
import "./tokens.css";
import "./globals.css";
import "./landing.css";
import "./actions.css";
import "./quick.css";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "BizDecide · Your AI CFO",
  description: "AI CFO for Malaysian small businesses. Upload your sales and purchases, get three decisions. CFO skills also available for Tencent WorkBuddy.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon-180.png",
  },
  manifest: "/site.webmanifest",
  openGraph: { images: ["/brand/og-lockup.png"] },
};

export const viewport: Viewport = {
  themeColor: "#3438A8",
  colorScheme: "light dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,800&family=Figtree:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <SiteHeader />
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
