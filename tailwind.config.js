/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: { primary: { 50: '#ecfdf5', 100: '#d1fae5', 600: '#059669', 700: '#047857', 900: '#064e3b' } },
      boxShadow: { soft: '0 10px 30px rgba(15, 23, 42, 0.08)' }
    }
  },
  plugins: []
};
