/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class', // Manual theme toggling via class
  theme: {
    extend: {
      colors: {
        // Theme-agnostic utility colors (keep as-is)
        primary: '#2563EB',
        secondary: '#6B7280',
        success: '#34D399',
        error: '#EF4444',
        warning: '#F59E0B',

        // Semantic theme colors (simplified)
        theme: {
          dark: {
            bg: '#1F2937',      // gray-800 (formerly dark-bg)
            surface: '#374151', // gray-700 (formerly dark-card)
            text: '#D1D5DB',   // gray-300
            'text-alt': '#E5E7EB', // gray-200
          },
          light: {
            bg: '#F3F4F6',     // gray-50
            surface: '#FFFFFF', // white
            text: '#1F2937',    // gray-800
          }
        }
      },
      transitionProperty: {
        'colors': 'background-color, border-color, color', // Smooth theme transitions
      }
    },
  },
  plugins: [],
};