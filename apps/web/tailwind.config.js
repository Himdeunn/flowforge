/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bone-white': '#F5F5F3',
        'ink-black': '#0B0B0C',
        'pastel-coral': '#FF8E7A',
        'muted-lavender': '#D6C7E8',
      },
    },
  },
  plugins: [],
}
