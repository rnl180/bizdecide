import type { Metadata, Viewport } from "next";
import "./tokens.css";
import "./globals.css";
import "./landing.css";
import "./actions.css";
import "./quick.css";
import { OfflineBanner } from "@/components/OfflineBanner";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "BizDecide · Your AI CFO",
  description: "Upload your business documents. We find you money: double payments, supplier overcharges and funding you qualify for.",
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
  themeColor: "#2A67A8",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Light mode only: data-theme="light" keeps tokens.css on its light values whatever the OS setting.
    <html lang="en" data-theme="light">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <SiteHeader />
        <OfflineBanner />
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
