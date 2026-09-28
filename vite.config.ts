import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

// Two pages: the landing page (with downloads) and account sign-up.
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    // Every asset as a file: the CSP (vercel.json) allows fonts and images from 'self' only.
    assetsInlineLimit: 0,
    // libsodium (Argon2 included) is one ~535 kB chunk, loaded only on the sign-up page.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        signup: resolve(import.meta.dirname, 'signup/index.html')
      }
    }
  }
})
