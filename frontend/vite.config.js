import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Bind sur toutes les interfaces (127.0.0.1 + IP LAN), pas seulement ::1.
  // Indispensable pour la démo réseau local (2-3 machines) du sujet.
  server: {
    host: true, // autorise les connexions externes (tunnel/LAN)
    port: 5174,
    // En dev, on proxifie l'API + le flux vidéo vers le Core (Pôle 2) pour rester
    // en same-origin (comme derrière le nginx de prod). Cible configurable.
    proxy: {
      '/auth': process.env.VITE_CORE_PROXY || 'http://localhost:3000',
      '/keys': process.env.VITE_CORE_PROXY || 'http://localhost:3000',
      '/admin': process.env.VITE_CORE_PROXY || 'http://localhost:3000',
      '/security': process.env.VITE_CORE_PROXY || 'http://localhost:3000',
      '/videos': process.env.VITE_CORE_PROXY || 'http://localhost:3000',
    },
  },
  optimizeDeps: {
    exclude: ['@phosphor-icons/react'],
  },
})
