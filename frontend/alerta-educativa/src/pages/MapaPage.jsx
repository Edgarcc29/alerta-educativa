// ============================================================
// pages/MapaPage.jsx - Pantalla de Mapa de Riesgo
// Cubre HU05 y HU06
// Muestra un mapa Leaflet con marcadores coloreados según
// el nivel de riesgo de cada institución.
// NOTA: Las coordenadas actuales son simuladas (coord_simulada=1).
// ============================================================

import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import { mapaAPI } from '../services/api'
import FiltrosRapidos from '../components/FiltrosRapidos'
import BadgeRiesgo from '../components/BadgeRiesgo'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'

// Color del marcador según nivel de riesgo
const COLOR_RIESGO = { ALTO: '#ef4444', MEDIO: '#f59e0b', BAJO: '#10b981' }

// Componente auxiliar que recentra el mapa cuando cambian los marcadores
function RecentrarMapa({ marcadores }) {
  const map = useMap()
  useEffect(() => {
    if (marcadores.length > 0) {
      const lats = marcadores.map(m => m.latitud)
      const lngs = marcadores.map(m => m.longitud)
      const centroLat = (Math.min(...lats) + Math.max(...lats)) / 2
      const centroLng = (Math.min(...lngs) + Math.max(...lngs)) / 2
      map.setView([centroLat, centroLng], 9)
    }
  }, [marcadores])
  return null
}

export default function MapaPage() {
  const [marcadores, setMarcadores] = useState([])
  const [resumen, setResumen]       = useState(null)
  const [altosRiesgo, setAltosRiesgo] = useState([])
  const [filtros, setFiltros]       = useState({ anio: 2024 })
  const [cargando, setCargando]     = useState(false)
  const [mensaje, setMensaje]       = useState('Aplica un filtro para cargar el mapa')

  const cargarMapa = async (f) => {
    // El mapa requiere al menos un filtro para no cargar 50 mil puntos
    if (!f.departamento && !f.provincia && !f.distrito && !f.ugel) {
      setMensaje('Selecciona un departamento u otro filtro para cargar el mapa')
      setMarcadores([])
      return
    }
    setCargando(true)
    try {
      const [r1, r2] = await Promise.all([
        mapaAPI.marcadores(f),
        mapaAPI.resumen(f),
      ])
      setMarcadores(r1.data)
      setResumen(r2.data.resumen)
      setAltosRiesgo(r2.data.instituciones_alto_riesgo)
      if (r1.data.length === 0) setMensaje('No hay instituciones con coordenadas para este filtro')
    } catch (e) {
      console.error(e)
      setMensaje('Error al cargar el mapa')
    } finally {
      setCargando(false)
    }
  }

  const handleFiltrar = (f) => {
    setFiltros(f)
    cargarMapa(f)
  }

  const pct = (n) => n != null ? `${Number(n).toFixed(1)}%` : '—'

  return (
    <div className="flex gap-6 h-[calc(100vh-120px)]">
      {/* ── Columna principal: mapa ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Mapa de riesgo</h1>
          <p className="text-sm text-gray-500">
            Distribución geográfica de las instituciones educativas según su nivel de riesgo de deserción escolar
          </p>
        </div>

        {/* Contenedor del mapa */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden relative">
          {cargando && (
            <div className="absolute inset-0 bg-white/70 z-50 flex items-center justify-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
            </div>
          )}

          {marcadores.length > 0 ? (
            <MapContainer
              center={[-9.19, -75.01]}
              zoom={6}
              className="h-full w-full"
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <RecentrarMapa marcadores={marcadores} />
              {marcadores.map((m) => (
                <CircleMarker
                  key={m.id_institucion}
                  center={[m.latitud, m.longitud]}
                  radius={6}
                  pathOptions={{
                    color: COLOR_RIESGO[m.nivel_riesgo] || '#94a3b8',
                    fillColor: COLOR_RIESGO[m.nivel_riesgo] || '#94a3b8',
                    fillOpacity: 0.8,
                    weight: 1,
                  }}
                >
                  {/* Popup al hacer clic en un marcador */}
                  <Popup>
                    <div className="text-sm min-w-48">
                      <p className="font-bold text-gray-800">{m.nombre}</p>
                      <p className="text-gray-500 text-xs">{m.distrito} · {m.nivel}</p>
                      <div className="mt-1 space-y-0.5 text-xs">
                        <p>Riesgo: <strong>{m.nivel_riesgo}</strong></p>
                        <p>Puntaje: <strong>{m.puntaje_reglas}</strong></p>
                        <p>Deserción: <strong>{pct(m.tasa_desercion_distrital)}</strong></p>
                        <p>Retiro: <strong>{pct(m.tasa_retiro)}</strong></p>
                        <p>Estudiantes: <strong>{m.total_estudiantes?.toLocaleString('es-PE')}</strong></p>
                      </div>
                      {m.coord_simulada === 1 && (
                        <p className="mt-1 text-orange-500 text-xs">⚠ Coordenadas simuladas</p>
                      )}
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3">
              <span className="text-6xl">🗺️</span>
              <p className="text-sm">{mensaje}</p>
            </div>
          )}

          {/* Leyenda superpuesta en el mapa */}
          {marcadores.length > 0 && (
            <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-md p-3 z-40 text-xs">
              <p className="font-semibold text-gray-700 mb-1.5">Nivel de riesgo</p>
              {[
                { nivel: 'ALTO', label: 'Riesgo Alto', count: resumen?.riesgo_alto },
                { nivel: 'MEDIO', label: 'Riesgo Medio', count: resumen?.riesgo_medio },
                { nivel: 'BAJO', label: 'Riesgo Bajo', count: resumen?.riesgo_bajo },
              ].map(({ nivel, label, count }) => (
                <div key={nivel} className="flex items-center gap-2 mb-0.5">
                  <span className="w-3 h-3 rounded-full inline-block"
                    style={{ backgroundColor: COLOR_RIESGO[nivel] }} />
                  <span className="text-gray-600">{label}</span>
                  <span className="font-medium text-gray-800 ml-auto">{count ?? '—'}</span>
                </div>
              ))}
              <div className="border-t border-gray-100 mt-1 pt-1 flex justify-between">
                <span className="text-gray-500">Total:</span>
                <span className="font-medium">{resumen?.total ?? '—'}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Columna lateral: filtros + resumen + lista alto riesgo ──── */}
      <div className="w-64 shrink-0 flex flex-col gap-4 overflow-y-auto">
        <FiltrosRapidos onFiltrar={handleFiltrar} mostrarNivelRiesgo />

        {/* Resumen del área filtrada */}
        {resumen && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Resumen del área filtrada</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-gray-50 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-gray-800">{resumen.total}</p>
                <p className="text-gray-500">Total IEI</p>
              </div>
              <div className="bg-red-50 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-red-600">{resumen.riesgo_alto}</p>
                <p className="text-red-500">Riesgo Alto</p>
              </div>
              <div className="bg-yellow-50 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-yellow-600">{resumen.riesgo_medio}</p>
                <p className="text-yellow-500">Riesgo Medio</p>
              </div>
              <div className="bg-green-50 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-green-600">{resumen.riesgo_bajo}</p>
                <p className="text-green-500">Riesgo Bajo</p>
              </div>
            </div>
          </div>
        )}

        {/* Lista de instituciones en alto riesgo */}
        {altosRiesgo.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
              <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />
              Instituciones en Alto Riesgo
            </h3>
            <div className="space-y-2">
              {altosRiesgo.map((ie, i) => (
                <div key={i} className="flex items-start justify-between gap-2 text-xs border-b border-gray-50 pb-1.5">
                  <div>
                    <p className="font-medium text-gray-700 leading-tight">{ie.nombre}</p>
                    <p className="text-gray-400">{ie.distrito}</p>
                  </div>
                  <BadgeRiesgo nivel="ALTO" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
