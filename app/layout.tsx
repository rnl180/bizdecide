import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BizDecide · Your AI CFO",
  description: "AI CFO for Malaysian small businesses. Upload your sales and purchases, get three decisions. Powered by Tencent WorkBuddy.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Instrument+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <header className="topbar">
          <a href="/" className="brand">
            <span className="brand-mark">B</span>
            BizDecide
          </a>
          <span className="topbar-tag">Your AI CFO · Powered by Tencent WorkBuddy</span>
        </header>
        <main>{children}</main>
        <footer className="footer">Not reports. Decisions. · Built for Malaysian SMEs</footer>
      </body>
    </html>
  );
}
