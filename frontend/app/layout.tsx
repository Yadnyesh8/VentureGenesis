import "./globals.css";
import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import Chrome from "@/components/Chrome";
import { StoreProvider } from "@/lib/store";

// One sentence, reused for the tab, Google's snippet and the Discord/Slack/iMessage
// unfurl, so the product never describes itself two different ways. The agent counts
// are the real ones in pipeline.py STEPS: 4 `ml` steps, 9 `llm`.
const TAGLINE = "AI-native startup intelligence";
const DESCRIPTION =
  "AI-native startup intelligence. Enter your numbers once: four trained models and nine reasoning agents run in a single pass and hand back one board verdict.";

// Absolute URLs are required by every unfurler — a relative og:image is simply
// dropped. Vercel exposes the deployment host, so previews unfurl with their own
// URL instead of pointing at production.
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
  "https://venture-genesis.vercel.app";

// The card is a committed PNG (public/og.png, source in scripts/og-image.html)
// rather than a generated app/opengraph-image.tsx: Satori ships one font weight,
// so the site's font-black hero rendered thin. Width and height are declared
// because Discord uses them to decide between a large card and a thumbnail.
const OG_IMAGE = {
  url: "/og.png",
  width: 1200,
  height: 630,
  alt: `VentureGenesis · ${TAGLINE}`,
};

// No `icons` field here on purpose. Declaring it overrides Next's file
// convention, which was pointing the favicon at the full-resolution
// public/logo.png (a 289 KB, non-square image fetched on every page load and
// squashed to fit). app/icon.png and app/apple-icon.png are picked up
// automatically and served hashed, correctly sized and square.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `VentureGenesis · ${TAGLINE}`,
    template: "%s · VentureGenesis",
  },
  description: DESCRIPTION,
  applicationName: "VentureGenesis",
  keywords: [
    "startup intelligence",
    "founder tools",
    "failure prediction",
    "revenue forecast",
    "AI board of directors",
  ],
  openGraph: {
    type: "website",
    siteName: "VentureGenesis",
    url: SITE_URL,
    title: `VentureGenesis · ${TAGLINE}`,
    description: DESCRIPTION,
    locale: "en_US",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: `VentureGenesis · ${TAGLINE}`,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
  robots: { index: true, follow: true },
};

// Discord tints an embed's left rule with theme-color. Matching the app surface
// keeps the unfurl on-brand instead of Discord's default grey.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0d" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
};

// Resolve the theme before first paint so the surface never flashes the wrong
// colour. Defaults to dark; an explicit choice in localStorage always wins.
const THEME_BOOT = `(function(){try{var t=localStorage.getItem("vg-theme");if(t!=="light"&&t!=="dark"){t="dark"}document.documentElement.setAttribute("data-theme",t)}catch(e){document.documentElement.setAttribute("data-theme","dark")}})()`;

// Keep Clerk's own surfaces (captcha, modals) on the app palette.
const clerkAppearance = {
  variables: {
    colorPrimary: "#e8e8e8",
    colorBackground: "#121212",
    colorText: "#e8e8e8",
    colorInputBackground: "#1f1f1f",
    colorInputText: "#e8e8e8",
    borderRadius: "12px",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body className="font-sans">
        <ClerkProvider appearance={clerkAppearance}>
          <StoreProvider>
            <Chrome>{children}</Chrome>
          </StoreProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
