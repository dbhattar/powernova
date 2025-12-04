/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#667eea',
          50: '#f5f7ff',
          100: '#ebefff',
          200: '#d6deff',
          300: '#b8c5ff',
          400: '#96a9ff',
          500: '#667eea',
          600: '#4d5fd1',
          700: '#3645a8',
          800: '#22307f',
          900: '#111d56',
        },
        secondary: {
          DEFAULT: '#764ba2',
          50: '#faf5ff',
          100: '#f5eaff',
          200: '#ead5ff',
          300: '#d8b5ff',
          400: '#c08fff',
          500: '#764ba2',
          600: '#5f3d84',
          700: '#482f66',
          800: '#322148',
          900: '#1b132a',
        },
      },
    },
  },
  plugins: [],
}
