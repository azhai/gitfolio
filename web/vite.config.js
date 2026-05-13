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
    rollupOptions: {
      output: {
        manualChunks: {
          'chakra-vendor': ['@chakra-ui/react', '@chakra-ui/icons', '@emotion/react', '@emotion/styled', 'framer-motion'],
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'editor': ['react-syntax-highlighter', 'date-fns', 'react-datepicker'],
          'icons': ['react-icons'],
        },
      },
    },
  },
})
