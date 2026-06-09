import "./globals.css";
import type { Metadata } from "next";
import TopNav from "@/components/TopNav";
import ProfileGuard from "@/components/ProfileGuard";
import { StoreProvider } from "@/lib/store";
import { display, almarai, mono, instrumentSerif } from "./fonts";

export const metadata: Metadata = {
  title: "VENTUREGENESIS",
  description: "AI-native Startup Operating System — your virtual board of directors.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${almarai.variable} ${mono.variable} ${instrumentSerif.variable}`}>
      <body className="font-sans">
        <StoreProvider>
          <TopNav />
          <main className="max-w-[1500px] mx-auto w-full px-5 py-8 md:py-10">
            <ProfileGuard>{children}</ProfileGuard>
          </main>
        </StoreProvider>
      </body>
    </html>
  );
}
