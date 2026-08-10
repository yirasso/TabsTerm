import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import { SiteHeader } from "@/components/chrome/site-header";
import { env } from "@/lib/env";
import { activeProviders } from "@/server/tabs/registry";
import { Providers } from "./providers";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
  title: {
    default: "TabsTerm — guitar tablature behind a text prompt",
    template: "%s · TabsTerm",
  },
  description: "No ads, no scroll-jacked lyrics, no login. Type a song, get the tab.",
  openGraph: {
    type: "website",
    siteName: "TabsTerm",
  },
};

export const viewport: Viewport = {
  themeColor: "#f2efe8",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const providers = activeProviders().map((p) => p.id);

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${jetbrainsMono.variable} antialiased`}>
        <Providers>
          <div className="tt-scanlines" aria-hidden />
          <SiteHeader providers={providers} />
          {children}
        </Providers>
      </body>
    </html>
  );
}
