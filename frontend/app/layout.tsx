import "./globals.css";
import type { Metadata } from "next";
import Chrome from "@/components/Chrome";
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
          <Chrome>{children}</Chrome>
        </StoreProvider>
      </body>
    </html>
  );
}
