import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Autorise les connexions externes (comme celle du tunnel Cloudflare)
    port: 5174,
  }
})
