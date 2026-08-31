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
  resolve: {
    extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json']
  },
  server: {
    port: 5174,
    strictPort: true, // Forces Vite to exit instead of jumping to 5174 if occupied
  },
})
