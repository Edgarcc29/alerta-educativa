// ============================================================
// pages/InstitucionesPage.jsx - Pantalla de Instituciones Educativas
// Cubre HU03, HU04, HU06, HU09, HU10 y HU15 (botón exportar)
// Combina en una sola pantalla:
//   - Buscador y filtros de búsqueda
//   - Tabla paginada de resultados
//   - Panel lateral con detalle de la institución seleccionada
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { institucionesAPI, filtrosAPI } from '../services/api'
import BadgeRiesgo from '../components/BadgeRiesgo'
import {
  MagnifyingGlassIcon, FunnelIcon, ChevronLeftIcon,
  ChevronRightIcon, ArrowDownTrayIcon, XMarkIcon
} from '@heroicons/react/24/outline'

const POR_PAGINA = 7

export default function InstitucionesPage() {
  // Estado de búsqueda y filtros
  const [buscar, setBuscar]       = useState('')
  const [filtros, setFiltros]     = useState({ anio: 2024 })
  const [pagina, setPagina]       = useState(1)

  // Datos
  const [resultado, setResultado] = useState({ datos: [], total: 0, total_paginas: 1 })
  const [detalle, setDetalle]     = useState(null)
  const [evolucion, setEvolucion] = useState([])
  const [tabDetalle, setTabDetalle] = useState('resumen')

  // Opciones de filtros
  const [dptos, setDptos]     = useState([])
  const [provs, setProvs]     = useState([])
  const [dists, setDists]     = useState([])
  const [ugeles, setUgeles]   = useState([])
  const [anios, setAnios]     = useState([])

  const [cargando, setCargando] = useState(false)
  const [mostrarFiltros, setMostrarFiltros] = useState(false)

  // Carga opciones de filtros al iniciar
  useEffect(() => {
    filtrosAPI.departamentos().then(r => setDptos(r.data))
    filtrosAPI.ugeles().then(r => setUgeles(r.data))
    filtrosAPI.anios().then(r => setAnios(r.data))
  }, [])

  // Cuando cambia el departamento seleccionado, carga sus provincias
  useEffect(() => {
    if (filtros.departamento) {
      filtrosAPI.provincias(filtros.departamento).then(r => setProvs(r.data))
    } else setProvs([])
  }, [filtros.departamento])

  // Cuando cambia la provincia seleccionada, carga sus distritos
  useEffect(() => {
    if (filtros.departamento && filtros.provincia) {
      filtrosAPI.distritos(filtros.departamento, filtros.provincia).then(r => setDists(r.data))
    } else setDists([])
  }, [filtros.provincia])

  // Función principal de búsqueda
  const buscarInstituciones = useCallback(async (pag = 1) => {
    setCargando(true)
    try {
      const params = { ...filtros, buscar, pagina: pag, por_pagina: POR_PAGINA }
      const r = await institucionesAPI.listar(params)
      setResultado(r.data)
      setPagina(pag)
    } catch (e) {
      console.error(e)
    } finally {
      setCargando(false)
    }
  }, [filtros, buscar])

  // Carga inicial
  useEffect(() => { buscarInstituciones() }, [])

  // Carga el detalle y la evolución de una institución seleccionada
  const verDetalle = async (ie) => {
    setDetalle(ie)
    setTabDetalle('resumen')
    try {
      const r = await institucionesAPI.evolucion(ie.cod_mod)
      setEvolucion(r.data)
    } catch {}
  }

  const handleFiltroChange = (e) => {
    const { name, value } = e.target
    setFiltros(f => ({ ...f, [name]: value }))
  }

  const aplicarFiltros = () => {
    buscarInstituciones(1)
    setMostrarFiltros(false)
  }

  const pct = (n) => n != null ? `${Number(n).toFixed(1)}%` : '—'
  const selectCls = "text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"

  return (
    <div className="space-y-4">
      {/* Título */}
      <div>
        <h1 className="text-xl font-bold text-gray-800">Instituciones Educativas</h1>
        <p className="text-sm text-gray-500">Consulta y filtra las instituciones para analizar sus indicadores</p>
      </div>

      {/* Barra de búsqueda */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex gap-3 flex-wrap items-end">
          {/* Buscador */}
          <div className="flex-1 min-w-52">
            <label className="text-xs text-gray-500 mb-1 block">Buscar institución</label>
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Nombre, código modular, UGEL..."
                value={buscar}
                onChange={e => setBuscar(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && buscarInstituciones(1)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Filtros inline */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Departamento</label>
            <select name="departamento" value={filtros.departamento || ''} onChange={handleFiltroChange} className={selectCls}>
              <option value="">Todos</option>
              {dptos.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Provincia</label>
            <select name="provincia" value={filtros.provincia || ''} onChange={handleFiltroChange} className={selectCls} disabled={!filtros.departamento}>
              <option value="">Todas</option>
              {provs.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Distrito</label>
            <select name="distrito" value={filtros.distrito || ''} onChange={handleFiltroChange} className={selectCls} disabled={!filtros.provincia}>
              <option value="">Todos</option>
              {dists.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Nivel de riesgo</label>
            <select name="nivel_riesgo" value={filtros.nivel_riesgo || ''} onChange={handleFiltroChange} className={selectCls}>
              <option value="">Todos</option>
              <option value="ALTO">Alto</option>
              <option value="MEDIO">Medio</option>
              <option value="BAJO">Bajo</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Año</label>
            <select name="anio" value={filtros.anio} onChange={handleFiltroChange} className={selectCls}>
              {anios.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          <button
            onClick={aplicarFiltros}
            className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <FunnelIcon className="h-4 w-4" /> Aplicar Filtros
          </button>
        </div>
      </div>

      {/* Contenido principal: tabla + panel detalle */}
      <div className="flex gap-4">
        {/* ── Tabla de resultados ─────────────────────────────────── */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">
              Resultados
              <span className="ml-2 text-gray-400 font-normal">
                ({resultado.total.toLocaleString()} instituciones)
              </span>
            </h2>
          </div>

          {cargando ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <th className="text-left px-3 py-2">N°</th>
                      <th className="text-left px-3 py-2">Institución</th>
                      <th className="text-left px-3 py-2">Cód. Modular</th>
                      <th className="text-left px-3 py-2">Distrito</th>
                      <th className="text-left px-3 py-2">Nivel</th>
                      <th className="text-left px-3 py-2">Gestión</th>
                      <th className="text-center px-3 py-2">Riesgo</th>
                      <th className="text-right px-3 py-2">Deserción</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.datos.map((ie, i) => (
                      <tr
                        key={ie.id_institucion}
                        className={`border-t border-gray-50 hover:bg-blue-50 transition-colors cursor-pointer
                          ${detalle?.id_institucion === ie.id_institucion ? 'bg-blue-50' : ''}`}
                        onClick={() => verDetalle(ie)}
                      >
                        <td className="px-3 py-2 text-gray-400">{(pagina - 1) * POR_PAGINA + i + 1}</td>
                        <td className="px-3 py-2 font-medium text-gray-800 max-w-xs truncate">{ie.nombre}</td>
                        <td className="px-3 py-2 text-gray-600">{ie.cod_mod}</td>
                        <td className="px-3 py-2 text-gray-600">{ie.distrito}</td>
                        <td className="px-3 py-2 text-gray-600">{ie.nivel}</td>
                        <td className="px-3 py-2 text-gray-600">{ie.gestion}</td>
                        <td className="px-3 py-2 text-center"><BadgeRiesgo nivel={ie.nivel_riesgo} /></td>
                        <td className="px-3 py-2 text-right">{pct(ie.tasa_desercion_distrital)}</td>
                        <td className="px-3 py-2 text-primary-600 text-lg">›</td>
                      </tr>
                    ))}
                    {resultado.datos.length === 0 && (
                      <tr><td colSpan={9} className="text-center py-10 text-gray-400">
                        No se encontraron instituciones con los filtros aplicados
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Paginación */}
              <div className="flex items-center justify-between mt-4 text-sm">
                <span className="text-gray-500">
                  Mostrando {((pagina - 1) * POR_PAGINA) + 1}–{Math.min(pagina * POR_PAGINA, resultado.total)} de {resultado.total.toLocaleString()}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => buscarInstituciones(pagina - 1)}
                    disabled={pagina <= 1}
                    className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                  >
                    <ChevronLeftIcon className="h-4 w-4" />
                  </button>
                  {/* Números de página */}
                  {[...Array(Math.min(resultado.total_paginas, 5))].map((_, i) => {
                    const p = i + Math.max(1, pagina - 2)
                    if (p > resultado.total_paginas) return null
                    return (
                      <button key={p} onClick={() => buscarInstituciones(p)}
                        className={`px-3 py-1 rounded border text-sm ${p === pagina
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'border-gray-200 hover:bg-gray-50'}`}>
                        {p}
                      </button>
                    )
                  })}
                  <button
                    onClick={() => buscarInstituciones(pagina + 1)}
                    disabled={pagina >= resultado.total_paginas}
                    className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                  >
                    <ChevronRightIcon className="h-4 w-4" />
                  </button>
                  <span className="text-gray-400 ml-1">{POR_PAGINA} por página</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Panel lateral de detalle ─────────────────────────────── */}
        {detalle ? (
          <div className="w-80 shrink-0 bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3">
            {/* Encabezado del detalle */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-gray-400">Detalle de la institución</p>
                <h3 className="font-bold text-gray-800 text-sm leading-tight">{detalle.nombre}</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Cód. {detalle.cod_mod} · {detalle.ugel}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <BadgeRiesgo nivel={detalle.nivel_riesgo} />
                <button onClick={() => setDetalle(null)} className="text-gray-400 hover:text-gray-600 mt-1">
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Pestañas */}
            <div className="flex gap-1 border-b border-gray-100 pb-1 text-xs">
              {['resumen', 'indicadores', 'evolucion', 'factores'].map(t => (
                <button key={t} onClick={() => setTabDetalle(t)}
                  className={`px-2 py-1 rounded capitalize transition-colors
                    ${tabDetalle === t ? 'bg-primary-100 text-primary-700 font-medium' : 'text-gray-500 hover:bg-gray-100'}`}>
                  {t}
                </button>
              ))}
            </div>

            {/* Contenido según pestaña */}
            {tabDetalle === 'resumen' && (
              <div className="space-y-2 text-sm">
                <FilaDetalle label="Nivel educativo" valor={detalle.nivel} />
                <FilaDetalle label="Gestión"         valor={detalle.gestion} />
                <FilaDetalle label="Año académico"   valor={filtros.anio} />
                <FilaDetalle label="Departamento"    valor={detalle.departamento} />
                <FilaDetalle label="Distrito"        valor={detalle.distrito} />
                <FilaDetalle label="Área"            valor={detalle.area} />
                <FilaDetalle label="Estudiantes"     valor={detalle.total_estudiantes?.toLocaleString('es-PE')} />
                <FilaDetalle label="Puntaje de riesgo" valor={
                  detalle.puntaje_reglas != null
                    ? `${(Number(detalle.puntaje_reglas) / 10).toFixed(1)} / 10`
                    : '—'
                } />
              </div>
            )}

            {tabDetalle === 'indicadores' && (
              <div className="space-y-2 text-sm">
                <FilaDetalle label="Deserción distrital" valor={pct(detalle.tasa_desercion_distrital)} />
                <FilaDetalle label="Retiro"              valor={pct(detalle.tasa_retiro)} />
                <FilaDetalle label="Desaprobación"       valor={pct(detalle.tasa_desaprobacion)} />
                <FilaDetalle label="Atraso escolar"      valor={pct(detalle.tasa_atraso)} />
                <FilaDetalle label="Recuperación"        valor={pct(detalle.tasa_recuperacion)} />
                <FilaDetalle label="Zona rural"          valor={detalle.zona_rural ? 'Sí' : 'No'} />
                <FilaDetalle label="IIEE en distrito"    valor={detalle.n_iiee_distrito} />
              </div>
            )}

            {tabDetalle === 'evolucion' && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Evolución 2021–2024 de indicadores clave</p>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={evolucion} margin={{ top: 0, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="anio" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} unit="%" />
                    <Tooltip formatter={(v) => `${v}%`} />
                    <Line type="monotone" dataKey="tasa_desaprobacion" name="Desap."
                          stroke="#3b82f6" strokeWidth={1.5} dot={{ r: 2 }} />
                    <Line type="monotone" dataKey="tasa_retiro" name="Retiro"
                          stroke="#ef4444" strokeWidth={1.5} dot={{ r: 2 }} />
                    <Line type="monotone" dataKey="tasa_atraso" name="Atraso"
                          stroke="#f59e0b" strokeWidth={1.5} dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {tabDetalle === 'factores' && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Factores que sustentan el nivel de riesgo:</p>
                {detalle.factores
                  ? detalle.factores.split(';').map((f, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-gray-700 mb-1">
                      <span className="text-red-400 mt-0.5">●</span>
                      <span>{f.trim()}</span>
                    </div>
                  ))
                  : <p className="text-sm text-gray-400">Sin factores destacados</p>
                }
              </div>
            )}
          </div>
        ) : (
          // Placeholder cuando no hay institución seleccionada
          <div className="w-80 shrink-0 bg-white rounded-xl shadow-sm border border-dashed border-gray-200 p-6
                          flex flex-col items-center justify-center text-gray-300">
            <BuildingOffice2IconOutline className="h-12 w-12 mb-3" />
            <p className="text-sm text-center">Selecciona una institución de la tabla para ver su detalle</p>
          </div>
        )}
      </div>
    </div>
  )
}

function FilaDetalle({ label, valor }) {
  return (
    <div className="flex justify-between gap-2 py-0.5 border-b border-gray-50">
      <span className="text-gray-500 text-xs">{label}</span>
      <span className="font-medium text-gray-700 text-xs text-right">{valor ?? '—'}</span>
    </div>
  )
}

// Ícono local para el placeholder (evita importar de nuevo)
function BuildingOffice2IconOutline({ className }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
      strokeWidth={1} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
    </svg>
  )
}
