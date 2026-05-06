import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
          800: "#9a3412",
          900: "#7c2d12",
          950: "#431407",
        },
        ink: {
          950: "#070a13",
          900: "#0c111f",
          800: "#121828",
          700: "#1a2135",
          600: "#232c44",
          500: "#3a4563",
          400: "#5d6a8a",
          300: "#8b96b3",
          200: "#bdc5d8",
          100: "#e3e7f1",
          50: "#f4f6fb",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(10,14,28,0.06), 0 8px 24px rgba(10,14,28,0.06)",
        cta: "0 10px 30px rgba(234,88,12,0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
