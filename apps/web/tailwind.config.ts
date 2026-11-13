import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0c1218",
        parchment: "#e8dcc8",
        brass: "#c4a35a",
        deep: "#15202b",
        panel: "#1a2633",
        mist: "#8fa3b5",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        lore: "0 12px 40px rgba(0,0,0,0.45)",
      },
    },
  },
  plugins: [],
};

export default config;
