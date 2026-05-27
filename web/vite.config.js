import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    chunkSizeWarningLimit: 550,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'chakra-core': ['@chakra-ui/react', '@emotion/react', '@emotion/styled', 'framer-motion'],
          'editor': ['react-syntax-highlighter'],
          'datepicker': ['react-datepicker', 'date-fns'],
          'icons': ['react-icons'],
        },
      },
    },
  },
})
