// ============================================================
// pages/MLPage.jsx — Predicción con Machine Learning
// Cubre HU08, HU13
//
// Datos reales (2024) vienen de eval_riesgo en BD.
// Proyecciones (2025, 2026) se calculan on-demand desde el modelo.
// ============================================================

import { useState, useEffect } from 'react'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine
} from 'recharts'
import { mlAPI, filtrosAPI } from '../services/api'
import BadgeRiesgo from '../components/BadgeRiesgo'
import {
  CpuChipIcon, FunnelIcon, ArrowPathIcon,
  ChevronLeftIcon, ChevronRightIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'

const POR_PAGINA = 15
const ANIO_REAL  = 2024
const ANIOS_PROYECCION = [2025, 2026]

export default function MLPage() {
  // ── Gráficos ──────────────────────────────────────────────────────────────
  const [evolucion, setEvolucion]   = useState([])   // [{anio, pct_alto, ...}]
  const [resumenBD, setResumenBD]   = useState([])   // [{anio, nivel_riesgo, cantidad}]
  const [topRiesgo, setTopRiesgo]   = useState([])
  const [resumProy, setResumProy]   = useState({})   // {2025:{...}, 2026:{...}}

  // ── Tabla ─────────────────────────────────────────────────────────────────
  const [tabla, setTabla]           = useState({ datos: [], total: 0, total_paginas: 1 })
  const [pagina, setPagina]         = useState(1)
  const [anioTabla, setAnioTabla]   = useState(ANIO_REAL)
  const [filtroRiesgo, setFiltroRiesgo] = useState('')
  const [filtroDpto, setFiltroDpto] = useState('')
  const [dptos, setDptos]           = useState([])

  // ── UI ────────────────────────────────────────────────────────────────────
  const [cargando, setCargando]         = useState(true)
  const [cargandoTabla, setCargandoTabla] = useState(false)
  const [sinDatos, setSinDatos]         = useState(false)

  // ── Carga inicial ─────────────────────────────────────────────────────────
  useEffect(() => {
    cargarTodo()
    filtrosAPI.departamentos().then(r => setDptos(r.data)).catch(() => {})
  }, [])

  const cargarTodo = async () => {
    setCargando(true)
    setSinDatos(false)
    try {
      // Primero carga solo los datos reales de BD (rápido)
      const [r1, r2, r3] = await Promise.all([
        mlAPI.evolucionRiesgo(),
        mlAPI.resumen(),
        mlAPI.topRiesgo({ limite: 10 }),
      ])

      // Si evolucion no devuelve nada, no hay datos ML en BD
      if (!r1.data || r1.data.length === 0) {
        setSinDatos(true)
        setCargando(false)
        return
      }

      setEvolucion(r1.data)
      setResumenBD(r2.data)
      setTopRiesgo(r3.data)

      // Tabla: año real por defecto
      await cargarTabla(1, ANIO_REAL)

      // Carga proyecciones por separado (no bloquea si fallan)
      for (const a of ANIOS_PROYECCION) {
        mlAPI.resumenProyeccion(a)
          .then(r => setResumProy(prev => ({ ...prev, [a]: r.data })))
          .catch(err => console.warn(`Proyección ${a} no disponible:`, err.message))
      }

    } catch (err) {
      console.error('Error cargando ML:', err)
      setSinDatos(true)
    } finally {
      setCargando(false)
    }
  }

  const cargarTabla = async (pag = 1, anio = anioTabla) => {
    setCargandoTabla(true)
    try {
      const params = {
        pagina: pag, por_pagina: POR_PAGINA,
        anio,
        ...(filtroRiesgo && { nivel_riesgo: filtroRiesgo }),
        ...(filtroDpto   && { departamento: filtroDpto }),
      }
      // 2024 → datos reales de BD; 2025/2026 → proyecciones on-demand
      const fn = ANIOS_PROYECCION.includes(Number(anio))
        ? mlAPI.proyecciones
        : mlAPI.predicciones
      const r = await fn(params)
      setTabla(r.data)
      setPagina(pag)
      setAnioTabla(Number(anio))
    } catch (e) { console.error(e) }
    finally { setCargandoTabla(false) }
  }

  // ── Datos para gráficos ───────────────────────────────────────────────────
  // Combina datos reales de BD + resúmenes de proyecciones para la línea
  const datosLinea = (() => {
    const base = evolucion.map(f => ({
      anio: f.anio, pct_alto: f.pct_alto, pct_medio: f.pct_medio,
      pct_bajo: f.pct_bajo, total: f.total, es_proyeccion: 0
    }))
    ANIOS_PROYECCION.forEach(a => {
      const d = resumProy[a]
      if (d?.total > 0) base.push({
        anio: a, pct_alto: d.pct_alto, pct_medio: d.pct_medio,
        pct_bajo: d.pct_bajo, total: d.total, es_proyeccion: 1
      })
    })
    return base.sort((a, b) => a.anio - b.anio)
  })()

  // Datos barras: combina reales + proyecciones
  const datosBarras = (() => {
    const mapa = {}
    resumenBD.forEach(f => {
      if (!mapa[f.anio]) mapa[f.anio] = { anio: f.anio, Alto: 0, Medio: 0, Bajo: 0, es_proyeccion: 0 }
      mapa[f.anio][f.nivel_riesgo === 'ALTO' ? 'Alto' : f.nivel_riesgo === 'MEDIO' ? 'Medio' : 'Bajo'] = f.cantidad
    })
    ANIOS_PROYECCION.forEach(a => {
      const d = resumProy[a]
      if (d?.total > 0) mapa[a] = { anio: a, Alto: d.alto, Medio: d.medio, Bajo: d.bajo, es_proyeccion: 1 }
    })
    return Object.values(mapa).sort((a, b) => a.anio - b.anio)
  })()

  const primerProyeccion = datosLinea.find(d => d.es_proyeccion)?.anio

  // Todos los años disponibles para las tarjetas y selector
  const todosAnios = [
    ...evolucion.map(f => ({ anio: f.anio, es_proyeccion: 0 })),
    ...ANIOS_PROYECCION.filter(a => resumProy[a]?.total > 0).map(a => ({ anio: a, es_proyeccion: 1 }))
  ].sort((a, b) => a.anio - b.anio)

  const fmt  = n => n != null ? Number(n).toLocaleString('es-PE') : '—'
  const prob = n => n != null ? `${(Number(n) * 100).toFixed(1)}%` : '—'
  const selectCls = "text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"

  // ── Sin datos ─────────────────────────────────────────────────────────────
  if (!cargando && sinDatos) return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
        <CpuChipIcon className="h-6 w-6 text-primary-600" /> Predicción ML
      </h1>
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-yellow-800 mb-2">El modelo aún no ha sido ejecutado</p>
            <p className="text-sm text-yellow-700 mb-3">
              Ejecuta el siguiente comando <strong>una sola vez</strong> en la carpeta <code className="bg-yellow-100 px-1 rounded">backend/</code>:
            </p>
            <pre className="bg-gray-900 text-green-300 text-sm rounded-lg px-4 py-3 font-mono">
              python ejecutar_ml.py
            </pre>
            <p className="text-xs text-yellow-600 mt-2">
              El proceso tarda ~2 minutos y guarda los resultados en la base de datos.
              Esta pantalla mostrará los gráficos automáticamente al terminar.
            </p>
          </div>
        </div>
      </div>
    </div>
  )

  if (cargando) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto mb-3" />
        <p className="text-sm text-gray-500">Cargando predicciones ML...</p>
      </div>
    </div>
  )

  // ── Pantalla principal ────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Encabezado */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <CpuChipIcon className="h-6 w-6 text-primary-600" />
            Predicción con Machine Learning
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Modelo Random Forest · datos reales 2021–2024 · proyecciones 2025 y 2026
          </p>
        </div>
        <button onClick={cargarTodo}
          className="flex items-center gap-1.5 text-sm text-primary-600 border border-primary-200
                     hover:bg-primary-50 px-3 py-2 rounded-lg transition-colors">
          <ArrowPathIcon className="h-4 w-4" /> Refrescar
        </button>
      </div>

      {/* ── Tarjetas por año ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {todosAnios.map(({ anio, es_proyeccion }) => {
          const fila = es_proyeccion ? resumProy[anio] : evolucion.find(f => f.anio === anio)
          if (!fila) return null
          const activo = anioTabla === anio
          return (
            <button key={anio} onClick={() => cargarTabla(1, anio)}
              className={`rounded-xl border p-3 text-left transition-all
                ${activo
                  ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-300 shadow-md'
                  : 'border-gray-100 bg-white shadow-sm hover:border-primary-300 hover:shadow-md'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-gray-800 text-base">{anio}</span>
                {es_proyeccion
                  ? <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">★ Proyección</span>
                  : <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">Real</span>}
              </div>
              <p className="text-xs text-gray-500">Total: <strong>{fmt(fila.total)}</strong></p>
              <div className="flex gap-1 mt-1.5 flex-wrap">
                <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">
                  {fila.pct_alto}% alto
                </span>
                <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">
                  {fila.pct_medio}% medio
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {/* ── Gráficos ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Línea: evolución % riesgo */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">
            Evolución del riesgo (% sobre total de instituciones)
          </h3>
          <p className="text-xs text-gray-400 mb-3">
            Línea punteada = años proyectados · haz clic para filtrar la tabla
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={datosLinea} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
              onClick={d => d?.activePayload?.[0]?.payload?.anio && cargarTabla(1, d.activePayload[0].payload.anio)}
              style={{ cursor: 'pointer' }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="anio" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
              <Tooltip formatter={(v, n) => [`${v}%`, n]}
                labelFormatter={l => {
                  const f = datosLinea.find(d => d.anio === l)
                  return `${l}${f?.es_proyeccion ? ' ★ Proyectado' : ''} — ${fmt(f?.total)} instituciones`
                }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {primerProyeccion && (
                <ReferenceLine x={primerProyeccion} stroke="#a78bfa" strokeDasharray="4 2"
                  label={{ value: '← Real | Proyección →', position: 'top', fontSize: 9, fill: '#7c3aed' }} />
              )}
              <Line type="monotone" dataKey="pct_alto" name="% Riesgo Alto"
                stroke="#ef4444" strokeWidth={2.5}
                dot={({ cx, cy, payload }) => (
                  <circle key={cx} cx={cx} cy={cy} r={payload.es_proyeccion ? 4 : 5}
                    fill={payload.es_proyeccion ? 'white' : '#ef4444'}
                    stroke="#ef4444" strokeWidth={2}
                    strokeDasharray={payload.es_proyeccion ? "3 2" : "0"} />
                )} />
              <Line type="monotone" dataKey="pct_medio" name="% Riesgo Medio"
                stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="pct_bajo" name="% Riesgo Bajo"
                stroke="#10b981" strokeWidth={1.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Barras apiladas */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">
            Cantidad de instituciones por nivel de riesgo y año
          </h3>
          <p className="text-xs text-gray-400 mb-3">Barras translúcidas = años proyectados</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={datosBarras} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
              onClick={d => d?.activePayload?.[0]?.payload?.anio && cargarTabla(1, d.activePayload[0].payload.anio)}
              style={{ cursor: 'pointer' }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="anio" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v, n) => [fmt(v), n]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Alto"  name="Riesgo Alto"  stackId="a" fill="#ef4444"
                fillOpacity={1} />
              <Bar dataKey="Medio" name="Riesgo Medio" stackId="a" fill="#f59e0b" />
              <Bar dataKey="Bajo"  name="Riesgo Bajo"  stackId="a" fill="#10b981" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Top 10 ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
          <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />
          Top 10 instituciones con mayor riesgo — Año {ANIO_REAL} (datos reales)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                <th className="text-left px-3 py-2">#</th>
                <th className="text-left px-3 py-2">Institución</th>
                <th className="text-left px-3 py-2">Distrito</th>
                <th className="text-left px-3 py-2">Nivel</th>
                <th className="text-center px-3 py-2">Riesgo ML</th>
                <th className="text-right px-3 py-2">Probabilidad retiro alto</th>
              </tr>
            </thead>
            <tbody>
              {topRiesgo.map((ie, i) => (
                <tr key={i} className="border-t border-gray-50 hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-400 font-medium">{i + 1}</td>
                  <td className="px-3 py-2 font-medium text-gray-800 max-w-xs truncate">{ie.nombre}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{ie.distrito}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{ie.nivel}</td>
                  <td className="px-3 py-2 text-center"><BadgeRiesgo nivel={ie.nivel_riesgo} /></td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-20 bg-gray-100 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full bg-red-500"
                          style={{ width: `${(ie.probabilidad_ml * 100).toFixed(0)}%` }} />
                      </div>
                      <span className="font-semibold text-red-600 text-xs w-10 text-right">
                        {prob(ie.probabilidad_ml)}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Tabla paginada ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">

        {/* Filtros */}
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Año</label>
            <select value={anioTabla}
              onChange={e => { setAnioTabla(Number(e.target.value)); cargarTabla(1, e.target.value) }}
              className={selectCls}>
              {todosAnios.map(({ anio, es_proyeccion }) => (
                <option key={anio} value={anio}>
                  {anio}{es_proyeccion ? ' ★ Proyectado' : ' (real)'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Nivel de riesgo</label>
            <select value={filtroRiesgo} onChange={e => setFiltroRiesgo(e.target.value)} className={selectCls}>
              <option value="">Todos</option>
              <option value="ALTO">Alto</option>
              <option value="MEDIO">Medio</option>
              <option value="BAJO">Bajo</option>
            </select>
          </div>
          <div className="flex-1 min-w-44">
            <label className="text-xs text-gray-500 mb-1 block">Departamento</label>
            <select value={filtroDpto} onChange={e => setFiltroDpto(e.target.value)} className={selectCls}>
              <option value="">Todos</option>
              {dptos.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <button onClick={() => cargarTabla(1)}
            className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700
                       text-white text-sm font-medium px-4 py-2 rounded-lg">
            <FunnelIcon className="h-4 w-4" /> Filtrar
          </button>
        </div>

        {/* Header tabla */}
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-700">
            Predicciones — {anioTabla}
            {ANIOS_PROYECCION.includes(anioTabla) &&
              <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">★ Proyectado</span>}
            <span className="ml-2 text-xs font-normal text-gray-400">
              ({tabla.total.toLocaleString()} registros)
            </span>
          </h3>
        </div>

        {cargandoTabla ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary-600" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <th className="text-left px-3 py-2">Institución</th>
                    <th className="text-left px-3 py-2">Nivel edu.</th>
                    <th className="text-left px-3 py-2">Departamento</th>
                    <th className="text-left px-3 py-2">Distrito</th>
                    <th className="text-center px-3 py-2">Riesgo ML</th>
                    <th className="text-right px-3 py-2">Probabilidad</th>
                  </tr>
                </thead>
                <tbody>
                  {tabla.datos.map((p, i) => (
                    <tr key={i} className={`border-t border-gray-50 hover:bg-gray-50
                      ${p.es_proyeccion ? 'bg-purple-50/20' : ''}`}>
                      <td className="px-3 py-2 font-medium text-gray-800 max-w-xs truncate">{p.nombre}</td>
                      <td className="px-3 py-2 text-gray-500 text-xs">{p.nivel}</td>
                      <td className="px-3 py-2 text-gray-500 text-xs">{p.departamento}</td>
                      <td className="px-3 py-2 text-gray-500 text-xs">{p.distrito}</td>
                      <td className="px-3 py-2 text-center"><BadgeRiesgo nivel={p.nivel_riesgo} /></td>
                      <td className="px-3 py-2 text-right">
                        <span className={`font-semibold text-xs ${
                          p.nivel_riesgo === 'ALTO'  ? 'text-red-600' :
                          p.nivel_riesgo === 'MEDIO' ? 'text-yellow-600' : 'text-green-600'}`}>
                          {prob(p.probabilidad_ml)}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {tabla.datos.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-10 text-gray-400 text-sm">
                      Sin datos con los filtros seleccionados
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {tabla.total_paginas > 1 && (
              <div className="flex items-center justify-between mt-4">
                <span className="text-xs text-gray-500">
                  Página {pagina} de {tabla.total_paginas} · {tabla.total.toLocaleString()} total
                </span>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => cargarTabla(pagina - 1)} disabled={pagina <= 1}
                    className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
                    <ChevronLeftIcon className="h-4 w-4" />
                  </button>
                  {[...Array(Math.min(tabla.total_paginas, 5))].map((_, i) => {
                    const p = i + Math.max(1, pagina - 2)
                    if (p > tabla.total_paginas) return null
                    return (
                      <button key={p} onClick={() => cargarTabla(p)}
                        className={`px-3 py-1 rounded border text-xs ${p === pagina
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'border-gray-200 hover:bg-gray-50'}`}>
                        {p}
                      </button>
                    )
                  })}
                  <button onClick={() => cargarTabla(pagina + 1)} disabled={pagina >= tabla.total_paginas}
                    className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
                    <ChevronRightIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
