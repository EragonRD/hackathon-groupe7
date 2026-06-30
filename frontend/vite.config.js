import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Bind sur toutes les interfaces (127.0.0.1 + IP LAN), pas seulement ::1.
  // Indispensable pour la démo réseau local (2-3 machines) du sujet.
  server: { host: true },
  optimizeDeps: {
    exclude: ['@phosphor-icons/react'],
  },
})
