import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/contractor/',
  plugins: [
    tailwindcss(),
    react(),
  ],
  server: {
    port: 5173,
    strictPort: true, // Forces Vite to exit instead of jumping to 5174 if occupied
  },
})
