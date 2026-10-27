/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        terminal: {
          ink: '#0C0D0A',
          panel: '#15170F',
          panel2: '#1B1E14',
          line: '#2A2D22',
          paper: '#EDEAE0',
          muted: '#8F8C7E',
          accent: '#E2A63D',
          'accent-dark': '#C9932F',
          bull: '#2E9E62',
          bear: '#C94A3A',
        }
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'float-slow': 'float-slow 8s ease-in-out infinite',
        'float-fast': 'float-fast 4s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
        'orbit': 'orbit 20s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '50%': { transform: 'translateY(-10px) rotate(1deg)' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '50%': { transform: 'translateY(-15px) rotate(-1deg)' },
        },
        'float-fast': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: 0.3, filter: 'drop-shadow(0 0 5px rgba(226, 166, 61, 0.2))' },
          '50%': { opacity: 0.8, filter: 'drop-shadow(0 0 15px rgba(226, 166, 61, 0.6))' },
        },
        orbit: {
          '0%': { transform: 'rotate(0deg) translateX(80px) rotate(0deg)' },
          '100%': { transform: 'rotate(360deg) translateX(80px) rotate(-360deg)' }
        }
      }
    },
  },
  plugins: [],
}
