// ============================================================
// pages/DashboardPage.jsx - Pantalla principal del sistema
// Cubre HU02, HU06 y parte de HU10
// Muestra: tarjetas KPI, gráfico de dona, gráfico de línea,
// tabla de instituciones que requieren atención y resumen de indicadores.
// ============================================================

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid
} from 'recharts'
import { dashboardAPI } from '../services/api'
import FiltrosRapidos from '../components/FiltrosRapidos'
import BadgeRiesgo from '../components/BadgeRiesgo'
import {
  BuildingOffice2Icon, UserGroupIcon,
  ExclamationTriangleIcon, ArrowTrendingUpIcon
} from '@heroicons/react/24/outline'

// Colores del gráfico de dona según nivel de riesgo
const COLORES_RIESGO = { ALTO: '#ef4444', MEDIO: '#f59e0b', BAJO: '#10b981' }

export default function DashboardPage() {
  const [kpi, setKpi]               = useState(null)
  const [distribucion, setDistrib]  = useState([])
  const [evolucion, setEvolucion]   = useState([])
  const [atencion, setAtencion]     = useState([])
  const [filtros, setFiltros]       = useState({ anio: 2024 })
  const [cargando, setCargando]     = useState(true)

  // Carga todos los datos del dashboard aplicando los filtros actuales
  const cargarDatos = async (f) => {
    setCargando(true)
    try {
      const [r1, r2, r3, r4] = await Promise.all([
        dashboardAPI.kpi(f),
        dashboardAPI.distribucionRiesgo(f),
        dashboardAPI.evolucion(f),
        dashboardAPI.mayorAtencion({ ...f, limite: 10 }),
      ])
      setKpi(r1.data)
      setDistrib(r2.data)
      setEvolucion(r3.data)
      setAtencion(r4.data)
    } catch (e) {
      console.error('Error cargando dashboard:', e)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargarDatos(filtros) }, [])

  const handleFiltrar = (f) => {
    setFiltros(f)
    cargarDatos(f)
  }

  // Formatea números grandes con separador de miles
  const fmt = (n) => n != null ? Number(n).toLocaleString('es-PE') : '—'
  const pct = (n) => n != null ? `${Number(n).toFixed(1)}%` : '—'

  return (
    <div className="flex gap-6">
      {/* ── Columna principal ──────────────────────────────────────── */}
      <div className="flex-1 space-y-6">
        {/* Título */}
        <div>
          <h1 className="text-xl font-bold text-gray-800">Dashboard General</h1>
          <p className="text-sm text-gray-500">Resumen de indicadores educativos y niveles de riesgo</p>
        </div>

        {cargando ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
          </div>
        ) : (
          <>
            {/* ── Cuatro tarjetas KPI ──────────────────────────────── */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              <TarjetaKPI
                icono={<BuildingOffice2Icon className="h-8 w-8 text-blue-500" />}
                valor={fmt(kpi?.total_instituciones)}
                etiqueta="Instituciones Educativas"
                sub="Total de instituciones"
              />
              <TarjetaKPI
                icono={<UserGroupIcon className="h-8 w-8 text-indigo-500" />}
                valor={fmt(kpi?.total_estudiantes)}
                etiqueta="Estudiantes"
                sub="Matrícula total"
              />
              <TarjetaKPI
                icono={<ExclamationTriangleIcon className="h-8 w-8 text-yellow-500" />}
                valor={fmt(kpi?.riesgo_medio)}
                etiqueta="Riesgo Medio"
                sub={`${pct(kpi?.pct_riesgo_medio)} del total`}
                colorSub="text-yellow-600"
              />
              <TarjetaKPI
                icono={<ExclamationTriangleIcon className="h-8 w-8 text-red-500" />}
                valor={fmt(kpi?.riesgo_alto)}
                etiqueta="Riesgo Alto"
                sub={`${pct(kpi?.pct_riesgo_alto)} del total`}
                colorSub="text-red-600"
              />
            </div>

            {/* ── Gráficos: dona + línea ────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Gráfico de dona */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">
                  Distribución por nivel de riesgo
                </h2>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={distribucion}
                      dataKey="cantidad"
                      nameKey="nivel_riesgo"
                      cx="50%" cy="50%"
                      innerRadius={55} outerRadius={85}
                      paddingAngle={3}
                      label={({ nivel_riesgo, percent }) =>
                        `${nivel_riesgo} ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {distribucion.map((e, i) => (
                        <Cell key={i} fill={COLORES_RIESGO[e.nivel_riesgo] || '#94a3b8'} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => fmt(v)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Gráfico de línea: evolución histórica */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">
                  Evolución histórica de indicadores
                </h2>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={evolucion} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="anio" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} unit="%" />
                    <Tooltip formatter={(v) => `${v}%`} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="tasa_desaprobacion" name="Desaprobación"
                          stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="tasa_retiro" name="Retiro"
                          stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="tasa_atraso" name="Atraso"
                          stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="tasa_desercion_distrital" name="Deserción distrital"
                          stroke="#8b5cf6" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ── Tabla: instituciones que requieren mayor atención ─── */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700">
                  Instituciones que requieren mayor atención
                </h2>
                <Link to="/instituciones"
                  className="text-xs text-primary-600 hover:underline font-medium">
                  Ver todas las instituciones →
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <th className="text-left px-3 py-2">Institución</th>
                      <th className="text-left px-3 py-2">Distrito</th>
                      <th className="text-left px-3 py-2">Nivel</th>
                      <th className="text-center px-3 py-2">Riesgo</th>
                      <th className="text-right px-3 py-2">Deserción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {atencion.map((ie, i) => (
                      <tr key={i} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-2 font-medium text-gray-800 max-w-xs truncate">
                          {ie.nombre}
                        </td>
                        <td className="px-3 py-2 text-gray-600">{ie.distrito}</td>
                        <td className="px-3 py-2 text-gray-600">{ie.nivel}</td>
                        <td className="px-3 py-2 text-center">
                          <BadgeRiesgo nivel={ie.nivel_riesgo} />
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          {pct(ie.tasa_desercion_distrital)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Columna lateral: filtros + resumen de indicadores ──────── */}
      <div className="w-64 shrink-0 space-y-4">
        <FiltrosRapidos onFiltrar={handleFiltrar} />

        {/* Resumen de cinco indicadores */}
        {kpi && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Resumen de indicadores</h3>
            <div className="space-y-2">
              <IndicadorFila label="Tasa de Deserción Distrital" valor={pct(kpi.tasa_desercion_distrital)} />
              <IndicadorFila label="Tasa de Retiro"              valor={pct(kpi.tasa_retiro)} />
              <IndicadorFila label="Tasa de Desaprobación"       valor={pct(kpi.tasa_desaprobacion)} />
              <IndicadorFila label="Tasa de Atraso Escolar"      valor={pct(kpi.tasa_atraso)} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Subcomponentes ────────────────────────────────────────────────────────────

function TarjetaKPI({ icono, valor, etiqueta, sub, colorSub = 'text-gray-500' }) {
  return (
    <div className="kpi-card">
      <div className="flex items-center gap-3">
        {icono}
        <div>
          <p className="text-2xl font-bold text-gray-800">{valor}</p>
          <p className="text-xs font-medium text-gray-600">{etiqueta}</p>
        </div>
      </div>
      <p className={`text-xs ${colorSub}`}>{sub}</p>
    </div>
  )
}

function IndicadorFila({ label, valor }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-600 text-xs">{label}</span>
      <span className="font-semibold text-gray-800">{valor}</span>
    </div>
  )
}
