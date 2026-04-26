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
        bat: {
          gold: '#d4a012',
          golddim: '#b8890f',
          ink: '#0c1222',
          mist: 'rgba(255,255,255,0.06)',
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
