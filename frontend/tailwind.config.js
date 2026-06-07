/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#F8FAFC",
        // Ground
        ink: { 900: "#0A0B0F", 850: "#0D0F15" },
        surface: "#14171F",
        surface2: "#1A1E29",
        // Structure
        line: "#232734",
        "line-strong": "#2E3342",
        grid: "#171B24",
        // Type
        text: "#EDEAE0",
        "text-dim": "#CBD5E1",
        "text-mute": "#94A3B8",
        // Signals (fixed meaning)
        signal: "#C2F24A",
        aqua: "#34E1D2",
        violet: "#7C6CFF",
        coral: "#FF5D5D",
        amber: "#FFB13C",
        magenta: "#FF4FA3",
        // legacy aliases (kept so any stray class still resolves)
        bg: "#0A0B0F",
        panel: "#14171F",
        panel2: "#1A1E29",
        edge: "#232734",
        brand: "#7C6CFF",
        brand2: "#7C6CFF",
        accent: "#34E1D2",
        good: "#C2F24A",
        warn: "#FFB13C",
        bad: "#FF5D5D",
        muted: "#94A3B8",
      },
      fontFamily: {
        serif: ['"Instrument Serif"', 'serif'],
        display: ["var(--font-display)", "Impact", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      letterSpacing: {
        clinical: "0.12em",
      },
    },
  },
  plugins: [],
};
