import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "Inter",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "'Segoe UI'",
          "sans-serif"
        ],
        mono: [
          "var(--font-fira-code)",
          "'Fira Code'",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace"
        ]
      },
      colors: {
        surface: {
          DEFAULT: "#0f172a",
          50: "#e2e8f0",
          100: "#cbd5f5"
        }
      }
    }
  },
  plugins: []
};

export default config;
