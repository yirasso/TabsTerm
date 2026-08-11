import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
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
  themeColor: "#f2efe8",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The font variable goes on <html>, not <body>: `--font-mono` is emitted at
    // :root, so the variable it references has to be in scope there too.
    <html lang="en" className={jetbrainsMono.variable} suppressHydrationWarning>
      <body className="antialiased">
        <Providers>
          <div className="tt-scanlines" aria-hidden />
          <SiteHeader />
          {children}
        </Providers>
      </body>
    </html>
  );
}
