/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#f6ffe0",
          100: "#e9ffa0",
          200: "#d4ff4a",
          300: "#c0f035",
          400: "#adf030",
          500: "#a3e635",
          600: "#84cc16",
          700: "#65a30d",
          800: "#3f6309",
          900: "#1a2e05",
          950: "#0d1702",
        },
        // Cyan accent for secondary interactive elements
        accent: {
          300: "#67e8f9",
          400: "#22d3ee",
          500: "#06b6d4",
          600: "#0891b2",
        },
        // Violet for premium/special badges
        violet: {
          300: "#c4b5fd",
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
        },
        // Surface scale for backgrounds
        surface: {
          0: "#040406",
          1: "#07070d",
          2: "#0d0d16",
          3: "#12121e",
          4: "#181826",
          5: "#1e1e2e",
          6: "#26263a",
        },
        // Keep dark namespace for backward compat
        dark: {
          bg:     "#040406",
          card:   "#0d0d16",
          border: "#1e1e2e",
          muted:  "#181826",
        },
      },
      boxShadow: {
        "neon-sm":  "0 0 8px 1px rgba(163,230,53,0.25)",
        "neon":     "0 0 16px 3px rgba(163,230,53,0.35)",
        "neon-lg":  "0 0 32px 6px rgba(163,230,53,0.3), 0 0 8px 2px rgba(163,230,53,0.5)",
        "cyan-sm":  "0 0 8px 1px rgba(34,211,238,0.2)",
        "card":     "0 4px 24px rgba(0,0,0,0.4), 0 1px 4px rgba(0,0,0,0.3)",
        "card-hover": "0 8px 40px rgba(0,0,0,0.5), 0 0 24px rgba(163,230,53,0.06)",
        "inner-brand": "inset 0 1px 0 rgba(163,230,53,0.08)",
      },
      backgroundImage: {
        "gradient-brand": "linear-gradient(135deg, #c4ff5a 0%, #a3e635 40%, #22d3ee 100%)",
        "gradient-surface": "linear-gradient(135deg, rgba(13,13,22,0.9) 0%, rgba(7,7,13,0.95) 100%)",
      },
      animation: {
        "float":        "float 4s ease-in-out infinite",
        "glow-text":    "glow-text 3s ease-in-out infinite",
        "fade-in-up":   "fade-in-up 0.4s cubic-bezier(0.4,0,0.2,1) both",
        "fade-in":      "fade-in 0.3s ease-out both",
        "pulse-neon":   "pulse-neon 2.5s ease-in-out infinite",
        "shimmer":      "shimmer 2s linear infinite",
        "ticker":       "ticker-scroll 40s linear infinite",
        "orb-drift":    "orb-drift 20s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
