// ============================================================
// pages/ReportesPage.jsx - Pantalla de Reportes
// Cubre HU15
// Muestra cinco plantillas de reporte con vista previa JSON
// y botón de descarga en PDF.
// ============================================================

import { useState } from 'react'
import { reportesAPI } from '../services/api'
import FiltrosRapidos from '../components/FiltrosRapidos'
import BadgeRiesgo from '../components/BadgeRiesgo'
import {
  DocumentChartBarIcon, BuildingOffice2Icon,
  ArrowTrendingUpIcon, MapIcon, ChartBarIcon,
  ArrowDownTrayIcon, PlayIcon
} from '@heroicons/react/24/outline'

// Definición de las cinco plantillas de reportes
const PLANTILLAS = [
  {
    tipo: 'resumen_ejecutivo',
    titulo: 'Resumen Ejecutivo',
    descripcion: 'Panorama general de indicadores clave y niveles de riesgo',
    icono: DocumentChartBarIcon,
    color: 'blue',
  },
  {
    tipo: 'por_nivel_riesgo',
    titulo: 'Instituciones por nivel de riesgo',
    descripcion: 'Listado de instituciones por nivel de riesgo',
    icono: BuildingOffice2Icon,
    color: 'indigo',
  },
  {
    tipo: 'tendencias',
    titulo: 'Tendencias de deserción',
    descripcion: 'Análisis de la evolución de la tasa de deserción',
    icono: ArrowTrendingUpIcon,
    color: 'green',
  },
  {
    tipo: 'mapa_riesgo',
    titulo: 'Mapa de riesgo por deserción',
    descripcion: 'Visualización y resumen del riesgo por ubicación',
    icono: MapIcon,
    color: 'purple',
  },
  {
    tipo: 'factores',
    titulo: 'Factores asociados al riesgo',
    descripcion: 'Análisis de los principales factores de riesgo',
    icono: ChartBarIcon,
    color: 'red',
  },
]

const COLORES = {
  blue:   'bg-blue-50 text-blue-600 border-blue-100',
  indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  green:  'bg-green-50 text-green-600 border-green-100',
  purple: 'bg-purple-50 text-purple-600 border-purple-100',
  red:    'bg-red-50 text-red-600 border-red-100',
}

export default function ReportesPage() {
  const [filtros, setFiltros]         = useState({ anio: 2024 })
  const [generando, setGenerando]     = useState(null) // tipo del reporte en generación
  const [descargando, setDescargando] = useState(null) // tipo del reporte descargándose
  const [preview, setPreview]         = useState(null) // datos del reporte para previsualización
  const [tipoActivo, setTipoActivo]   = useState(null)
  const [errorMsg, setErrorMsg]       = useState('')

  // Genera el reporte y muestra la previsualización en pantalla
  const handleGenerar = async (tipo) => {
    setGenerando(tipo)
    setPreview(null)
    setTipoActivo(tipo)
    setErrorMsg('')
    try {
      const r = await reportesAPI.datos(tipo, filtros)
      setPreview(r.data)
    } catch (e) {
      console.error('Error generando reporte:', e)
      setErrorMsg('Error al generar el reporte. Intenta de nuevo.')
    } finally {
      setGenerando(null)
    }
  }

  // Descarga el PDF usando Axios (con el token JWT en el header)
  // Evita el error "archivo no disponible" que ocurre con enlaces directos
  const handleDescargarPDF = async (tipo) => {
    setDescargando(tipo)
    setErrorMsg('')
    try {
      const nombreArchivo = `reporte_${tipo}_${filtros.anio || 2024}.pdf`
      await reportesAPI.descargarPDF(tipo, filtros, nombreArchivo)
    } catch (e) {
      console.error('Error descargando PDF:', e)
      setErrorMsg('No se pudo descargar el PDF. Verifica que el backend esté corriendo.')
    } finally {
      setDescargando(null)
    }
  }

  const pct = (n) => n != null ? `${Number(n).toFixed(1)}%` : '—'

  return (
    <div className="flex gap-6">
      {/* ── Columna principal ──────────────────────────────────────── */}
      <div className="flex-1 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Reportes</h1>
          <p className="text-sm text-gray-500">Genera y exporta reportes sobre riesgo de deserción escolar</p>
        </div>

        {/* Mensaje de error global */}
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {errorMsg}
          </div>
        )}

        {/* Plantillas de reporte */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Plantilla de reportes</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {PLANTILLAS.map(({ tipo, titulo, descripcion, icono: Icono, color }) => (
              <div
                key={tipo}
                className={`bg-white rounded-xl border shadow-sm p-5 flex flex-col gap-3
                  ${tipoActivo === tipo ? 'ring-2 ring-primary-500' : ''}`}
              >
                {/* Ícono y título */}
                <div className={`w-12 h-12 rounded-xl border flex items-center justify-center ${COLORES[color]}`}>
                  <Icono className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{titulo}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{descripcion}</p>
                </div>

                {/* Botones */}
                <div className="flex gap-2 mt-auto">
                  {/* Botón Generar: muestra la previsualización en pantalla */}
                  <button
                    onClick={() => handleGenerar(tipo)}
                    disabled={generando === tipo || descargando === tipo}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium
                               bg-primary-600 hover:bg-primary-700 disabled:opacity-60
                               text-white py-2 rounded-lg transition-colors"
                  >
                    {generando === tipo
                      ? <span className="animate-spin h-3 w-3 border-b-2 border-white rounded-full inline-block" />
                      : <PlayIcon className="h-3.5 w-3.5" />
                    }
                    {generando === tipo ? 'Generando...' : 'Generar'}
                  </button>

                  {/* Botón PDF: descarga el archivo usando Axios (con token JWT) */}
                  <button
                    onClick={() => handleDescargarPDF(tipo)}
                    disabled={descargando === tipo || generando === tipo}
                    title="Descargar PDF"
                    className="flex items-center justify-center gap-1 text-xs font-medium
                               border border-gray-200 hover:bg-gray-50 disabled:opacity-60
                               text-gray-600 px-3 py-2 rounded-lg transition-colors min-w-[60px]"
                  >
                    {descargando === tipo
                      ? <span className="animate-spin h-3 w-3 border-b-2 border-gray-400 rounded-full inline-block" />
                      : <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                    }
                    {descargando === tipo ? '...' : 'PDF'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Previsualización del reporte generado */}
        {preview && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">
                Vista previa: {PLANTILLAS.find(p => p.tipo === tipoActivo)?.titulo}
              </h2>
              <span className="text-xs text-gray-400">
                Generado el {new Date(preview.generado_en).toLocaleString('es-PE')}
              </span>
            </div>

            {/* Resumen ejecutivo */}
            {tipoActivo === 'resumen_ejecutivo' && preview.resumen && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <MiniKPI label="Instituciones" valor={preview.resumen.total_instituciones?.toLocaleString('es-PE')} />
                  <MiniKPI label="Estudiantes"   valor={preview.resumen.total_estudiantes?.toLocaleString('es-PE')} />
                  <MiniKPI label="Riesgo Alto"   valor={preview.resumen.riesgo_alto} color="text-red-600" />
                  <MiniKPI label="Riesgo Medio"  valor={preview.resumen.riesgo_medio} color="text-yellow-600" />
                </div>
                {preview.top_riesgo && <TablaSimple datos={preview.top_riesgo} />}
              </>
            )}

            {/* Por nivel de riesgo o factores */}
            {(tipoActivo === 'por_nivel_riesgo' || tipoActivo === 'factores') && preview.instituciones && (
              <TablaSimple datos={preview.instituciones.slice(0, 15)} />
            )}

            {/* Tendencias */}
            {tipoActivo === 'tendencias' && preview.tendencias && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500">
                    <th className="text-left px-3 py-2">Año</th>
                    <th className="text-right px-3 py-2">Desaprobación</th>
                    <th className="text-right px-3 py-2">Retiro</th>
                    <th className="text-right px-3 py-2">Atraso</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.tendencias.map((f, i) => (
                    <tr key={i} className="border-t border-gray-50">
                      <td className="px-3 py-2 font-medium">{f.anio}</td>
                      <td className="px-3 py-2 text-right">{pct(f.tasa_desaprobacion)}</td>
                      <td className="px-3 py-2 text-right">{pct(f.tasa_retiro)}</td>
                      <td className="px-3 py-2 text-right">{pct(f.tasa_atraso)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Mapa de riesgo */}
            {tipoActivo === 'mapa_riesgo' && preview.por_distrito && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500">
                    <th className="text-left px-3 py-2">Distrito</th>
                    <th className="text-left px-3 py-2">Departamento</th>
                    <th className="text-right px-3 py-2">Total</th>
                    <th className="text-right px-3 py-2">Alto</th>
                    <th className="text-right px-3 py-2">Medio</th>
                    <th className="text-right px-3 py-2">Bajo</th>
                    <th className="text-right px-3 py-2">Deserción</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.por_distrito.slice(0, 20).map((f, i) => (
                    <tr key={i} className="border-t border-gray-50">
                      <td className="px-3 py-2 font-medium">{f.distrito}</td>
                      <td className="px-3 py-2 text-gray-500">{f.departamento}</td>
                      <td className="px-3 py-2 text-right">{f.total}</td>
                      <td className="px-3 py-2 text-right text-red-600 font-medium">{f.alto}</td>
                      <td className="px-3 py-2 text-right text-yellow-600">{f.medio}</td>
                      <td className="px-3 py-2 text-right text-green-600">{f.bajo}</td>
                      <td className="px-3 py-2 text-right">{pct(f.tasa_desercion_prom)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* ── Columna lateral: filtros ───────────────────────────────── */}
      <div className="w-64 shrink-0">
        <FiltrosRapidos onFiltrar={(f) => setFiltros(f)} mostrarNivelRiesgo />
      </div>
    </div>
  )
}

// ── Subcomponentes ────────────────────────────────────────────────────────────

function MiniKPI({ label, valor, color = 'text-gray-800' }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 text-center">
      <p className={`text-xl font-bold ${color}`}>{valor}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  )
}

function TablaSimple({ datos }) {
  if (!datos?.length) return <p className="text-sm text-gray-400">Sin datos</p>
  const cols = Object.keys(datos[0])
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 text-gray-500 uppercase">
            {cols.map(c => <th key={c} className="text-left px-3 py-2">{c.replace(/_/g, ' ')}</th>)}
          </tr>
        </thead>
        <tbody>
          {datos.map((fila, i) => (
            <tr key={i} className="border-t border-gray-50 hover:bg-gray-50">
              {cols.map(c => (
                <td key={c} className="px-3 py-1.5">
                  {c === 'nivel_riesgo'
                    ? <BadgeRiesgo nivel={fila[c]} />
                    : String(fila[c] ?? '—')
                  }
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
