import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#172033",
        primary: "#176B5B",
        canvas: "#F4F7F6",
      },
      boxShadow: {
        soft: "0 18px 50px -26px rgba(23, 32, 51, 0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
