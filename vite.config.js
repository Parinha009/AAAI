import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Pin to 5173 so magic-link URLs (backend frontend_base_url) always match.
    // strictPort makes Vite fail loudly instead of drifting to 5174 if it's taken.
    port: 5173,
    strictPort: true,
    open: true,
  },
})
