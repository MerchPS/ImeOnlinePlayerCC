import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        app: 'var(--bg-app)',
        card: 'var(--bg-card)',
        nav: 'var(--bg-nav)',
        hover: 'var(--bg-hover)',
        main: 'var(--text-main)',
        muted: 'var(--text-muted)',
        subtle: 'var(--text-subtle)',
        line: 'var(--border-line)',
        'line-hover': 'var(--border-line-hover)',
        accent: 'var(--accent)',
        'accent-text': 'var(--accent-text)',
        'accent-hover': 'var(--accent-hover)',
      }
    }
  },
  plugins: []
};

export default config;
