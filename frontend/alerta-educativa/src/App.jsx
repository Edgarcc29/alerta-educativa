// ============================================================
// App.jsx - Enrutador principal de la aplicación
// Define las rutas y qué pantalla muestra cada una.
// Las rutas protegidas requieren haber iniciado sesión.
// ============================================================

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'

// Importación de páginas
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import InstitucionesPage from './pages/InstitucionesPage'
import MapaPage from './pages/MapaPage'
import ReportesPage from './pages/ReportesPage'
import MLPage from './pages/MLPage'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Ruta pública: Login */}
          <Route path="/login" element={<LoginPage />} />

          {/* Rutas protegidas: requieren estar autenticado */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              {/* Redirige la raíz al dashboard */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard"     element={<DashboardPage />} />
              <Route path="/instituciones" element={<InstitucionesPage />} />
              <Route path="/mapa"          element={<MapaPage />} />
              <Route path="/reportes"      element={<ReportesPage />} />
              <Route path="/ml"            element={<MLPage />} />
            </Route>
          </Route>

          {/* Cualquier ruta desconocida redirige al dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
