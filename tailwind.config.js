/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'dark': '#0a0a2a',
        'neon': '#00f3ff',
        'purple-dark': '#2d1b4e',
      }
    },
  },
  plugins: [],
}