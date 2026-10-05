// Configuración de Vite para el proyecto React
// Define el puerto del servidor de desarrollo y el proxy hacia el backend
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Redirige las llamadas /api/* al backend FastAPI en el puerto 8000
    // Así evitamos problemas de CORS durante el desarrollo
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  }
})
