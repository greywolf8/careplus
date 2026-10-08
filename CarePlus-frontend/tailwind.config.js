/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        // CarePlus color scheme - dark but not black, blue-green/teal environment
        background: {
          DEFAULT: '#eef4f1',
          sidebar: '#e9f2ee',
          surface: '#f4f7f5',
        },
        surface: {
          lowest: '#ffffff',
          low: '#f8faf9',
          high: '#e8f0eb',
          container: '#e4ede8',
          containerHigh: '#d8eae1',
        },
        primary: {
          DEFAULT: '#2b9360',
          fixed: '#1e754a',
          container: '#d8eae1',
          50: '#edf7f2',
          100: '#d7ece2',
          200: '#b4dcc9',
          300: '#91cbb0',
          400: '#6ebaa7',
          500: '#4ba99e',
          600: '#2b9360',
          700: '#1e754a',
          800: '#154a31',
          900: '#123d29',
        },
        // Muted green primary accent
        success: {
          DEFAULT: '#2e8b57',
          container: '#eaf6ef',
          light: '#4ade80',
        },
        // Muted blue informational accent
        info: {
          DEFAULT: '#3b7bd4',
          container: '#eaf2fd',
          light: '#60a5fa',
        },
        // Muted yellow/amber attention accent
        warning: {
          DEFAULT: '#d85d38',
          container: '#fef1ea',
          light: '#fbbf24',
        },
        error: {
          DEFAULT: '#dc2626',
          container: '#fee2e2',
        },
        text: {
          primary: '#1e293b',
          secondary: '#475569',
          tertiary: '#64748b',
          outline: '#94a3b8',
        },
        border: {
          DEFAULT: '#dde7e2',
          light: '#e2e8e0',
        },
      },
      boxShadow: {
        'xs': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'sm': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
      },
    },
  },
  plugins: [],
}
