import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:9000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-syntax-highlighter/dist/esm/styles')) return 'syntax-styles'
            if (id.includes('react-syntax-highlighter')) return 'syntax-highlighter'
            if (id.includes('@uiw/react-markdown-preview') || id.includes('@uiw/react-markdown-editor')) return 'markdown-editor'
            if (id.includes('framer-motion')) return 'framer-motion'
            if (id.includes('@chakra-ui') || id.includes('@emotion')) return 'chakra-core'
            if (id.includes('react-dom') || id.includes('react-router-dom') || id.includes('/react/') || id.includes('react-icons')) return 'react-vendor'
            if (id.includes('react-datepicker') || id.includes('date-fns')) return 'datepicker'
          }
        },
      },
    },
  },
})
