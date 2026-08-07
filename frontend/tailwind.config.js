/** @type {import('tailwindcss').Config} */

// Every colour resolves through an RGB channel variable defined in globals.css.
// That keeps utilities theme-aware (light/dark) while still accepting an alpha
// modifier — `bg-signal/10` and `border-coral/40` both still work.
const ch = (name) => `rgb(var(--${name}-rgb) / <alpha-value>)`;

module.exports = {
  darkMode: ["class", ':root[data-theme="dark"]'],
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Ground
        ink: { 900: ch("ink-900"), 850: ch("ink-850") },
        surface: ch("surface"),
        surface2: ch("surface-2"),
        surface3: ch("surface-3"),
        // Structure
        line: ch("line"),
        "line-soft": ch("line-soft"),
        "line-strong": ch("line-strong"),
        grid: ch("line-soft"),
        // Type
        text: ch("text"),
        "text-dim": ch("text-dim"),
        "text-mute": ch("text-mute"),
        "text-faint": ch("text-faint"),
        primary: ch("text"),
        // Signals (fixed meaning)
        signal: ch("signal"),
        aqua: ch("aqua"),
        violet: ch("violet"),
        coral: ch("coral"),
        amber: ch("amber"),
        magenta: ch("magenta"),
        // Legacy aliases — kept so no stray class in the older pages goes unstyled.
        bg: ch("ink-900"),
        panel: ch("surface"),
        panel2: ch("surface-2"),
        edge: ch("line"),
        brand: ch("aqua"),
        brand2: ch("aqua"),
        accent: ch("aqua"),
        good: ch("signal"),
        warn: ch("amber"),
        bad: ch("coral"),
        muted: ch("text-mute"),
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
        // Retired faces resolve to the system stack rather than 404-ing.
        display: ["var(--font-sans)"],
        serif: ["var(--font-sans)"],
      },
      letterSpacing: {
        clinical: "0.2em",
      },
      borderRadius: {
        md: "12px",
        lg: "16px",
        xl: "16px",
        "2xl": "20px",
      },
      boxShadow: {
        soft: "var(--shadow-sm)",
        card: "var(--shadow-md)",
        lift: "var(--shadow-lg)",
        // Retired glow tokens flatten out.
        "glow-violet": "none",
        "glow-aqua": "none",
      },
      maxWidth: {
        shell: "1280px",
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
