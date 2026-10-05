// Configuración de Tailwind CSS
// Escanea los archivos JSX para generar solo las clases que se usan
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      // Colores personalizados de la identidad visual de Alerta Educativa
      colors: {
        primary: {
          50:  '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#1a56db',   // Azul principal (barra de navegación)
          700: '#1e40af',
          800: '#1e3a8a',
        },
        riesgo: {
          alto:  '#ef4444',  // Rojo
          medio: '#f59e0b',  // Amarillo
          bajo:  '#10b981',  // Verde
        }
      }
    },
  },
  plugins: [],
}
