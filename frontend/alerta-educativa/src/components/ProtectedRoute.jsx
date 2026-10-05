// ============================================================
// components/ProtectedRoute.jsx
// Guarda de ruta: si el usuario no está autenticado,
// lo redirige al login. Si sí lo está, muestra la página.
// ============================================================

import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute() {
  const { usuario, cargando } = useAuth()

  // Mientras verifica la sesión, muestra una pantalla de carga
  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4" />
          <p className="text-gray-500">Cargando...</p>
        </div>
      </div>
    )
  }

  // Si no hay usuario, redirige al login
  if (!usuario) return <Navigate to="/login" replace />

  // Si hay usuario, renderiza las rutas hijas (el Layout + la página)
  return <Outlet />
}
