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
          50: '#f0f4ff',
          100: '#e0e9fe',
          500: '#4f46e5',
          600: '#4338ca',
          700: '#3730a3',
          900: '#1e1b4b',
        },
        gov: {
          saffron: '#FF9933',
          navy: '#000080',
          green: '#138808',
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
        display: ['"Space Grotesk"', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
