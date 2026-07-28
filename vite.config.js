import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Empty inline PostCSS config so Vite does NOT search parent folders
  // (a stray C:\postcss.config.mjs would otherwise break the dev server).
  css: {
    postcss: {},
  },
  server: {
    open: true,
  },
})
