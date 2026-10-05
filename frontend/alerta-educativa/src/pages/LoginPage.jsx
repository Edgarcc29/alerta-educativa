// ============================================================
// pages/LoginPage.jsx - Pantalla de inicio de sesión
// Cubre HU01, RF01 y RNF01
// ============================================================

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import LogoAlerta from '../components/LogoAlerta'

export default function LoginPage() {
  const [usuario, setUsuario]     = useState('')
  const [password, setPassword]   = useState('')
  const [verPass, setVerPass]     = useState(false)
  const [error, setError]         = useState('')
  const [cargando, setCargando]   = useState(false)

  const { login } = useAuth()
  const navigate  = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setCargando(true)
    try {
      await login(usuario, password)
      navigate('/dashboard')
    } catch (err) {
      setError(
        err.response?.data?.detail || 'Usuario o contraseña incorrectos'
      )
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="min-h-screen bg-primary-600 flex items-center justify-between px-8">
      {/* ── Panel del formulario ── */}
      <div className="w-full max-w-sm mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Logo moderno SVG */}
          <div className="text-center mb-6">
            <div className="flex justify-center mb-3">
              <div className="w-16 h-16 rounded-2xl bg-primary-600 flex items-center justify-center shadow-lg">
                <LogoAlerta size={42} white />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-primary-600 tracking-tight">Alerta Educativa</h1>
            <p className="text-sm text-gray-500 mt-1">Sistema de Alerta Temprana — UGEL</p>
          </div>

          {/* Mensaje de error */}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Campo usuario */}
            <div>
              <input
                type="text"
                placeholder="usuario"
                value={usuario}
                onChange={e => setUsuario(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm
                           focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            {/* Campo contraseña con botón mostrar/ocultar */}
            <div className="relative">
              <input
                type={verPass ? 'text' : 'password'}
                placeholder="contraseña"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-3 pr-10 text-sm
                           focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setVerPass(!verPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {verPass
                  ? <EyeSlashIcon className="h-5 w-5" />
                  : <EyeIcon className="h-5 w-5" />}
              </button>
            </div>

            {/* Botón ingresar */}
            <button
              type="submit"
              disabled={cargando}
              className="w-full bg-primary-600 hover:bg-primary-700 disabled:opacity-60
                         text-white font-semibold py-3 rounded-lg transition-colors"
            >
              {cargando ? 'Ingresando...' : 'INGRESAR'}
            </button>
          </form>

          {/* Enlace olvido contraseña */}
          <p className="text-center mt-4 text-sm text-gray-500">
            <button className="hover:text-primary-600 hover:underline">
              ¿Olvidaste tu contraseña?
            </button>
          </p>
        </div>
      </div>

      {/* ── Panel decorativo derecho ── */}
      <div className="hidden lg:flex flex-col items-center justify-center text-white gap-6 pr-8">
        {/* Ícono grande decorativo */}
        <div className="w-28 h-28 rounded-3xl bg-white/15 backdrop-blur-sm border border-white/20
                        flex items-center justify-center shadow-2xl">
          <LogoAlerta size={72} white />
        </div>
        <div className="text-center">
          <p className="text-2xl font-semibold tracking-wide">Sistema de Alerta Temprana</p>
          <p className="text-sm text-blue-200 mt-1">Deserción Escolar — UGEL</p>
        </div>
        {/* Línea decorativa */}
        <div className="flex gap-2 mt-2">
          <div className="w-2 h-2 rounded-full bg-white opacity-60" />
          <div className="w-8 h-2 rounded-full bg-white opacity-40" />
          <div className="w-2 h-2 rounded-full bg-white opacity-60" />
        </div>
      </div>
    </div>
  )
}
