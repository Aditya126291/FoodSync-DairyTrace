/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['"Fraunces"', 'Georgia', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      colors: {
        // Page background and soft surfaces.
        canvas: '#F5F8F6',
        // Brand green: primary actions, links, positive accents.
        brand: {
          50: '#F0F9F4',
          100: '#DCF1E5',
          200: '#BBE3CD',
          300: '#8CCDAD',
          400: '#55B087',
          500: '#2F9467',
          600: '#1E7852',
          700: '#185F43',
          800: '#144C37',
          900: '#103D2D',
          950: '#08241B',
        },
        // Warm neutral scale for text, borders and surfaces.
        ink: {
          50: '#F8FAF8',
          100: '#EEF2EF',
          200: '#DFE6E1',
          300: '#C8D2CB',
          400: '#9BA99F',
          500: '#728077',
          600: '#56635A',
          700: '#3F4A43',
          800: '#29332D',
          900: '#17211B',
        },
      },
      borderRadius: {
        card: '1rem',
        control: '0.75rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(27, 26, 23, 0.04), 0 6px 20px -8px rgba(27, 26, 23, 0.08)',
        pop: '0 12px 40px -12px rgba(27, 26, 23, 0.25)',
      },
      maxWidth: {
        prose: '65ch',
      },
    },
  },
  plugins: [],
};
