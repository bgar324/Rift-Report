import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}', './app/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-exo2)', 'ui-sans-serif', 'system-ui'],
      },
    },
  },
  plugins: [],
}
export default config
