module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#2563EB',
        secondary: '#6B7280',
        success: '#10B981',
        error: '#EF4444',
        warning: '#F59E0B',
        dark: {
          bg: '#1F2937',
          card: '#374151',
          text: '#D1D5DB',
        },
        light: {
          bg: '#F9FAFB',
          card: '#FFFFFF',
          text: '#1F2937',
        },
      },
    },
  },
  plugins: [],
};