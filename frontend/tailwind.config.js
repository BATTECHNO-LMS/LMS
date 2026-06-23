/** @type {import('tailwindcss').Config} */
export default {
  important: '#battechno-landing',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['system-ui', 'Segoe UI', 'Roboto', 'Noto Sans Arabic', 'sans-serif'],
      },
      colors: {
        /** Landing + marketing — mirrors :root tokens from `abstracts/_variables.scss` */
        bat: {
          bg: 'var(--color-bg)',
          surface: 'var(--color-card)',
          border: 'var(--color-border)',
          'border-tinted': 'var(--color-border-tinted)',
          ink: 'var(--color-heading)',
          muted: 'var(--color-text-muted)',
          text: 'var(--color-text)',
          primary: 'var(--color-primary)',
          'primary-hover': 'var(--color-primary-hover)',
          'primary-dark': 'var(--color-primary-dark)',
          'primary-light': 'var(--color-primary-light)',
          secondary: 'var(--color-secondary)',
          accent: 'var(--color-accent)',
          'accent-hover': 'var(--color-accent-hover)',
          'accent-soft': 'var(--color-accent-soft)',
          'surface-header': 'var(--color-surface-header)',
          'surface-light': 'var(--color-surface-light)',
          'surface-alt': 'var(--color-surface-alt)',
        },
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0,0,0,0.35)',
        phone: '0 24px 80px rgba(0,0,0,0.45)',
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  },
};
