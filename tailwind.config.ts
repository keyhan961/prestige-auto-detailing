import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        obsidian: '#050505',
        graphite: '#101114',
        charcoal: '#17191f',
        platinum: '#e6e6e3',
        chrome: '#cfd2d4',
        steel: '#8f9499',
        champagne: '#b1121a',
        gold: '#e21b23',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      boxShadow: {
        glow: '0 0 70px rgba(226, 27, 35, 0.28)',
      },
      backgroundImage: {
        luxury: 'linear-gradient(135deg, rgba(226,27,35,.18), transparent 38%, rgba(207,210,212,.10))',
        chrome: 'linear-gradient(180deg, #ffffff 0%, #d4d7da 34%, #8f9499 68%, #f4f4f2 100%)',
        'redline': 'linear-gradient(90deg, transparent, rgba(226,27,35,.95), transparent)',
      },
    },
  },
  plugins: [],
} satisfies Config;
