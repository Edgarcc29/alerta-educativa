// ============================================================
// context/AuthContext.jsx - Estado global de autenticación
// Provee: usuario actual, funciones login/logout, y si está cargando.
// Todos los componentes que necesiten saber quién está logueado
// usan el hook useAuth() en lugar de leer localStorage directamente.
// ============================================================

import { createContext, useContext, useState, useEffect } from 'react'
import { authAPI } from '../services/api'

// Crea el contexto (el "canal" por donde viajan los datos de autenticación)
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // Estado del usuario autenticado
  const [usuario, setUsuario] = useState(null)
  const [cargando, setCargando] = useState(true)

  // Al cargar la app, revisa si hay un token guardado en localStorage
  useEffect(() => {
    const token = localStorage.getItem('token')
    const datosUsuario = localStorage.getItem('usuario')
    if (token && datosUsuario) {
      try {
        setUsuario(JSON.parse(datosUsuario))
      } catch {
        localStorage.removeItem('usuario')
      }
    }
    setCargando(false)
  }, [])

  // Función de login: llama al backend y guarda el token
  const login = async (nombreUsuario, password) => {
    const response = await authAPI.login(nombreUsuario, password)
    const datos = response.data
    // Guarda el token JWT en localStorage para persistir la sesión
    localStorage.setItem('token', datos.access_token)
    localStorage.setItem('usuario', JSON.stringify({
      nombre: datos.nombre,
      rol: datos.rol,
      id: datos.id_usuario,
    }))
    setUsuario({ nombre: datos.nombre, rol: datos.rol, id: datos.id_usuario })
    return datos
  }

  // Función de logout: limpia el estado y el localStorage
  const logout = async () => {
    try { await authAPI.logout() } catch {}
    localStorage.removeItem('token')
    localStorage.removeItem('usuario')
    setUsuario(null)
  }

  return (
    <AuthContext.Provider value={{ usuario, cargando, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// Hook personalizado para usar el contexto de autenticación fácilmente
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
