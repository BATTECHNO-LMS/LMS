/** @type {import('tailwindcss').Config} */
export default {
  important: '#battechno-landing',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Tajawal', 'IBM Plex Sans Arabic', 'Inter', 'system-ui', 'sans-serif'],
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
          'primary-soft': 'var(--color-primary-soft)',
          secondary: 'var(--color-secondary)',
          accent: 'var(--color-accent)',
          'accent-hover': 'var(--color-accent-hover)',
          'accent-dark': 'var(--color-accent-dark)',
          'accent-soft': 'var(--color-accent-soft)',
          'surface-header': 'var(--color-surface-header)',
          'surface-light': 'var(--color-surface-light)',
          'surface-alt': 'var(--color-surface-alt)',
          success: 'var(--color-success)',
          warning: 'var(--color-warning)',
          danger: 'var(--color-danger)',
          info: 'var(--color-info)',
        },
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0,0,0,0.35)',
        phone: '0 24px 80px rgba(0,0,0,0.45)',
        soft: 'var(--shadow-soft)',
        card: 'var(--shadow-card)',
      },
      borderRadius: {
        xl: 'var(--radius-xl)',
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  },
};
