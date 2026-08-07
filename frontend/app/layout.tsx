import "./globals.css";
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import Chrome from "@/components/Chrome";
import { StoreProvider } from "@/lib/store";

export const metadata: Metadata = {
  title: "VentureGenesis",
  description: "AI-native startup intelligence platform — metrics in, predictions out.",
  icons: { icon: "/logo.png", apple: "/logo.png" },
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
