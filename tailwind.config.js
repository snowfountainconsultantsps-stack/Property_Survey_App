/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        "survey-light": "#f5f5f5",
        "survey-dark": "#0f2d5c",
        "survey-blue": "#1e40af",
        "survey-accent": "#2f8683",
        "survey-title": "#1f2937",
        "survey-description": "#4b5563",
        "survey-gray": "#6b7280",
      },
    },
  },
  plugins: [],
};
