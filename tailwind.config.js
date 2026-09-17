/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Pretendard Variable', 'Pretendard', 'Inter', 'sans-serif'] },
      colors: { primary: '#2563EB', secondary: '#60A5FA' },
      boxShadow: { card: '0 1px 2px rgba(15,23,42,.03), 0 14px 40px rgba(30,64,175,.07)' },
    },
  },
  plugins: [],
}
