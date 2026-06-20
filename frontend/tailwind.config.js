/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#F4F6FB",
        // Ground
        ink: { 900: "#07080C", 850: "#0B0D13" },
        surface: "#12151D",
        surface2: "#181C27",
        surface3: "#1F2433",
        // Structure
        line: "#232838",
        "line-soft": "#1B1F2B",
        "line-strong": "#303749",
        grid: "#141823",
        // Type
        text: "#F4F6FB",
        "text-dim": "#C3CCDB",
        "text-mute": "#8A95AA",
        "text-faint": "#5C6679",
        // Signals (fixed meaning)
        signal: "#C2F24A",
        aqua: "#34E1D2",
        violet: "#7C6CFF",
        coral: "#FF5D5D",
        amber: "#FFB13C",
        magenta: "#FF4FA3",
        // legacy aliases (kept so any stray class still resolves)
        bg: "#07080C",
        panel: "#12151D",
        panel2: "#181C27",
        edge: "#232838",
        brand: "#7C6CFF",
        brand2: "#7C6CFF",
        accent: "#34E1D2",
        good: "#C2F24A",
        warn: "#FFB13C",
        bad: "#FF5D5D",
        muted: "#8A95AA",
      },
      fontFamily: {
        serif: ['"Instrument Serif"', 'serif'],
        display: ["var(--font-display)", "Impact", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      letterSpacing: {
        clinical: "0.14em",
      },
      borderRadius: {
        md: "12px",
        lg: "16px",
        xl: "20px",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(0,0,0,0.4)",
        card: "0 1px 0 rgba(255,255,255,0.03), 0 8px 24px -8px rgba(0,0,0,0.55)",
        lift: "0 1px 0 rgba(255,255,255,0.04), 0 24px 60px -18px rgba(0,0,0,0.7)",
        "glow-violet": "0 0 0 1px #232838, 0 24px 60px -28px rgba(124,108,255,0.35)",
        "glow-aqua": "0 0 0 1px #232838, 0 24px 60px -28px rgba(52,225,210,0.35)",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        fadeIn: "fadeIn 0.3s cubic-bezier(0.16,1,0.3,1)",
      },
    },
  },
  plugins: [],
};
