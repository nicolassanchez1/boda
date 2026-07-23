import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Warm, elegant palette — ivory base, ink text, terracotta + sage accents.
        ivory: {
          50: '#fdfbf7',
          100: '#f7f1e6',
          200: '#efe6d2',
        },
        ink: {
          DEFAULT: '#2a2520',
          soft: '#4a423a',
          muted: '#7a6f64',
        },
        terracotta: {
          DEFAULT: '#b85c38',
          dark: '#8d4327',
        },
        sage: {
          DEFAULT: '#8a9a7b',
          dark: '#6b7a5d',
        },
        gold: '#c8a96a',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        wider: '0.08em',
      },
      boxShadow: {
        soft: '0 4px 24px -8px rgba(42, 37, 32, 0.12)',
        lift: '0 12px 36px -12px rgba(42, 37, 32, 0.18)',
      },
    },
  },
  plugins: [],
};

export default config;
