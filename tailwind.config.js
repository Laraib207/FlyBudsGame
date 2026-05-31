/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['JetBrains Mono', 'Space Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        ibza: {
          void: '#050608',
          panel: '#0b0e13',
          amber: '#f6b53c',
          teal: '#1aa589',
          red: '#ff4d4d',
        },
      },
    },
  },
  plugins: [],
}
