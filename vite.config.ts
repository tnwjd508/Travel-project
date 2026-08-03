import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': '/src' } },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ['recharts'],
          motion: ['framer-motion'],
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
})
