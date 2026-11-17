/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        page: '#f6f7fb',
        border: '#e5e7eb',
        brand: '#4f46e5',
        status: {
          danger: '#dc2626',
        },
      },
      borderRadius: {
        card: '12px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 24, 40, 0.06)',
      },
      transitionDuration: {
        fade: '200ms',
      },
      fontSize: {
        body: ['14px', '22px'],
      },
    },
  },
  plugins: [],
}
