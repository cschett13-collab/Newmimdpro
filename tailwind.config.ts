import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef6ff",
          100: "#d9eaff",
          200: "#bcdaff",
          300: "#8ec2ff",
          400: "#599eff",
          500: "#2f78ff",
          600: "#1a59f5",
          700: "#1544db",
          800: "#183ab0",
          900: "#19368a",
          950: "#12235a",
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
      },
      boxShadow: {
        card: "0 1px 2px rgba(10,14,28,0.06), 0 8px 24px rgba(10,14,28,0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
