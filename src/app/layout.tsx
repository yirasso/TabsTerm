import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import { AdoptLocalTabs } from "@/components/chrome/adopt-local-tabs";
import { AuthReturn } from "@/components/chrome/auth-return";
import { SessionSync } from "@/components/chrome/session-sync";
import { SiteHeader } from "@/components/chrome/site-header";
import { env } from "@/lib/env";
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
  // `--tt-bg` of the crt theme, which is the default. It tints the browser's
  // own chrome on mobile, so a light value here framed a dark page in white.
  themeColor: "#0e1319",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The font variable goes on <html>, not <body>: `--font-mono` is emitted at
    // :root, so the variable it references has to be in scope there too.
    <html lang="en" className={jetbrainsMono.variable} suppressHydrationWarning>
      <body className="antialiased">
        <Providers>
          <div className="tt-scanlines" aria-hidden />
          {/* None of these render anything: who is signed in, a sign-in that
              came back broken, and moving a browser's tabs into the account it
              now has. */}
          <SessionSync />
          <AuthReturn />
          <AdoptLocalTabs />
          <SiteHeader />
          {children}
        </Providers>
      </body>
    </html>
  );
}
