// ============================================================
// components/Layout.jsx - Estructura común de todas las páginas
// Incluye la barra de navegación azul superior y el área de contenido.
// Las páginas se renderizan dentro del <Outlet />.
// ============================================================

import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  HomeIcon, BuildingOffice2Icon, MapIcon,
  DocumentChartBarIcon, UserCircleIcon, ArrowRightOnRectangleIcon,
  CpuChipIcon
} from '@heroicons/react/24/outline'
import LogoAlerta from './LogoAlerta'

// Definición de los ítems del menú de navegación
const NAV_ITEMS = [
  { to: '/dashboard',     label: 'Dashboard',      icon: HomeIcon },
  { to: '/instituciones', label: 'Instituciones',  icon: BuildingOffice2Icon },
  { to: '/mapa',          label: 'Mapa de riesgo', icon: MapIcon },
  { to: '/reportes',      label: 'Reportes',       icon: DocumentChartBarIcon },
  { to: '/ml',            label: 'Predicción ML',  icon: CpuChipIcon },
]

export default function Layout() {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* ── Barra de navegación azul ───────────────────────────── */}
      <header className="bg-primary-600 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-screen-2xl mx-auto px-4 flex items-center justify-between h-14">
          {/* Logo SVG moderno + nombre */}
          <div className="flex items-center gap-2.5 font-bold text-lg tracking-wide">
            <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
              <LogoAlerta size={22} white />
            </div>
            <span className="hidden sm:block">ALERTA EDUCATIVA</span>
          </div>

          {/* Menú de navegación central */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                   ${isActive
                     ? 'bg-white text-primary-600'
                     : 'text-blue-100 hover:bg-primary-700'}`
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Menú de usuario */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <UserCircleIcon className="h-6 w-6 text-blue-200" />
              <div className="hidden sm:block text-right">
                <p className="font-medium leading-none">{usuario?.nombre}</p>
                <p className="text-xs text-blue-200 mt-0.5">{usuario?.rol}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className="p-1.5 rounded-lg hover:bg-primary-700 transition-colors"
            >
              <ArrowRightOnRectangleIcon className="h-5 w-5 text-blue-100" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Área de contenido de cada página ──────────────────── */}
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
