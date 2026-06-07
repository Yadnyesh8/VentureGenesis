import "./globals.css";
import type { Metadata } from "next";
import Sidebar from "@/components/Sidebar";
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
          <div className="flex">
            <Sidebar />
            <main className="flex-1 min-h-screen p-6 md:p-10 max-w-[1400px] mx-auto w-full">
              <ProfileGuard>{children}</ProfileGuard>
            </main>
          </div>
        </StoreProvider>
      </body>
    </html>
  );
}
