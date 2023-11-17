const defaultTheme = require('tailwindcss/defaultTheme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./**/*.{html,css}'],
  theme: {
    container: {
      center: true,
    },
    extend: {
      fontFamily: {
        sans: [...defaultTheme.fontFamily.sans],
        mono: ['Courier Prime', ...defaultTheme.fontFamily.mono],
      },
    },
  },
}

