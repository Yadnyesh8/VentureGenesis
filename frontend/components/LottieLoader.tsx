"use client";
import dynamic from "next/dynamic";
import animationData from "@/lib/loadingLottie.json";

// lottie-react pulls in lottie-web which touches `document`, so load it client-only.
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

export default function LottieLoader({ size = 280 }: { size?: number }) {
  return (
    <div style={{ width: size, height: size }} className="mx-auto">
      <Lottie animationData={animationData as any} loop autoplay />
    </div>
  );
}
