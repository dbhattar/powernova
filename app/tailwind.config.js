module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./screens/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#007AFF',
        secondary: '#f0f0f0',
        background: '#fff',
        surface: '#f8f9fa',
        text: '#333',
        'text-secondary': '#666',
        'border': '#e1e4e8',
        'error': '#FF3B30',
        'success': '#28a745',
      },
      fontFamily: {
        'sf-pro': ['SF Pro Text', 'system-ui', 'sans-serif'],
        'roboto': ['Roboto', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'xs': ['12px', '16px'],
        'sm': ['14px', '20px'],
        'base': ['16px', '24px'],
        'lg': ['18px', '28px'],
        'xl': ['20px', '28px'],
        '2xl': ['24px', '32px'],
      },
      spacing: {
        '18': '72px',
        '88': '352px',
      },
      borderRadius: {
        'button': '12px',
        'card': '16px',
      },
    },
  },
  plugins: [],
}
