import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
      },
      colors: {
        cream: "#F5EFE0",
        navy: "#0D1117",
        brand: {
          blue: "#2563EB",
          yellow: "#F5C518",
          red: "#DC2626",
        },
      },
      boxShadow: {
        brutal: "4px 4px 0px 0px #0D1117",
        "brutal-sm": "2px 2px 0px 0px #0D1117",
        "brutal-lg": "6px 6px 0px 0px #0D1117",
        "brutal-blue": "4px 4px 0px 0px #2563EB",
        "brutal-yellow": "4px 4px 0px 0px #F5C518",
      },
      borderRadius: {
        lg: "0px",
        md: "0px",
        sm: "0px",
        DEFAULT: "0px",
        xl: "0px",
        "2xl": "0px",
        full: "9999px",
      },
    },
  },
  plugins: [],
};

export default config;
