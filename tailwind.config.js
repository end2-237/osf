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
        primary: '#FF9900',
        secondary: '#EAEDED',
        amz: {
          navy:      '#131921',
          navyMid:   '#232F3E',
          navyHov:   '#37475A',
          orange:    '#FF9900',
          orangeHov: '#E47911',
          yellow:    '#FFD814',
          yellowHov: '#F7CA00',
          teal:      '#007185',
          price:     '#B12704',
          deal:      '#CC0C39',
          border:    '#D5D9D9',
          bg:        '#EAEDED',
          text:      '#0F1111',
          textGray:  '#565959',
          link:      '#007185',
          badge:     '#FEBD69',
        },
      },
      animation: {
        'spin-slow': 'spin 8s linear infinite',
        'marquee': 'marquee 25s linear infinite',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-100%)' },
        }
      }
    },
  },
  plugins: [],
}
