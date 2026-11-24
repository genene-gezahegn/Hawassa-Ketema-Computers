/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          red: '#D32F2F',
          darkRed: '#B71C1C',
          lightRed: '#FFEBEE',
          black: '#121212',
          gray: '#5f6368',
        }
      }
    },
  },
  plugins: [],
}
