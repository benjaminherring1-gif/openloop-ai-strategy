/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  safelist: [
    'text-[10px]',
    'text-[11px]',
    'focus:border-[#1F3A5F]',
    'hover:border-[#1F3A5F]',
    'hover:text-[#1F3A5F]',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
