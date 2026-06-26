import "./globals.css";
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import Chrome from "@/components/Chrome";
import { StoreProvider } from "@/lib/store";
import { display, almarai, mono, instrumentSerif } from "./fonts";

export const metadata: Metadata = {
  title: "VENTUREGENESIS",
  description: "AI-native startup intelligence platform — metrics in, predictions out.",
  icons: { icon: "/logo.png", apple: "/logo.png" },
};

// Keep any Clerk-rendered surface (captcha, modals) on the app's dark palette.
const clerkAppearance = {
  variables: {
    colorPrimary: "#7C6CFF",
    colorBackground: "#12151D",
    colorText: "#F4F6FB",
    colorInputBackground: "#1F2433",
    colorInputText: "#F4F6FB",
    borderRadius: "12px",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${almarai.variable} ${mono.variable} ${instrumentSerif.variable}`}>
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
