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
          50:  "#f7ffe0",
          100: "#eaff9a",
          200: "#d4ff4a",
          300: "#c0f035",
          500: "#a3e635",
          600: "#84cc16",
          700: "#65a30d",
          900: "#1a2e05",
        },
        dark: {
          bg:      "#09090b",
          card:    "#111116",
          border:  "#1e1e28",
          muted:   "#27272f",
        },
      },
      boxShadow: {
        neon: "0 0 12px 2px rgba(163,230,53,0.35)",
        "neon-sm": "0 0 6px 1px rgba(163,230,53,0.25)",
      },
    },
  },
  plugins: [],
};
