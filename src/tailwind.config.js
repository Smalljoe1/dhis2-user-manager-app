/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#2563EB', // Blue
        secondary: '#6B7280', // Gray
        success: '#34D399', // Green
        error: '#EF4444', // Red
        warning: '#F59E0B', // Yellow
        'dark-bg': '#1F2937',
        'dark-card': '#374151',
        'dark-text': '#D1D5DB',
        'light-bg': '#F3F4F6',
        'light-card': '#FFFFFF',
        'light-text': '#1F2937',
      },
    },
  },
  plugins: [],
};

