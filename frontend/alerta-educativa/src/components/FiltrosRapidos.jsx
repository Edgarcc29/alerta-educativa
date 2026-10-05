// ============================================================
// components/FiltrosRapidos.jsx
// Panel de filtros reutilizable que aparece en Dashboard,
// Mapa y Reportes. Carga las opciones del backend y
// llama al callback onFiltrar con los valores seleccionados.
// ============================================================

import { useState, useEffect } from 'react'
import { filtrosAPI } from '../services/api'
import { FunnelIcon } from '@heroicons/react/24/outline'

export default function FiltrosRapidos({ onFiltrar, mostrarNivelRiesgo = false }) {
  // Opciones de cada desplegable
  const [departamentos, setDepartamentos] = useState([])
  const [provincias, setProvincias]       = useState([])
  const [distritos, setDistritos]         = useState([])
  const [ugeles, setUgeles]               = useState([])
  const [niveles, setNiveles]             = useState([])
  const [anios, setAnios]                 = useState([])

  // Valores seleccionados
  const [filtros, setFiltros] = useState({
    anio: 2024, departamento: '', provincia: '', distrito: '',
    ugel: '', nivel: '', nivel_riesgo: ''
  })

  // Carga los datos iniciales al montar el componente
  useEffect(() => {
    filtrosAPI.departamentos().then(r => setDepartamentos(r.data))
    filtrosAPI.niveles().then(r => setNiveles(r.data))
    filtrosAPI.anios().then(r => setAnios(r.data))
    filtrosAPI.ugeles().then(r => setUgeles(r.data))
  }, [])

  // Cuando cambia el departamento, carga sus provincias
  useEffect(() => {
    if (filtros.departamento) {
      filtrosAPI.provincias(filtros.departamento).then(r => setProvincias(r.data))
      filtrosAPI.ugeles(filtros.departamento).then(r => setUgeles(r.data))
    } else {
      setProvincias([])
      filtrosAPI.ugeles().then(r => setUgeles(r.data))
    }
    setFiltros(f => ({ ...f, provincia: '', distrito: '' }))
    setDistritos([])
  }, [filtros.departamento])

  // Cuando cambia la provincia, carga sus distritos
  useEffect(() => {
    if (filtros.departamento && filtros.provincia) {
      filtrosAPI.distritos(filtros.departamento, filtros.provincia)
        .then(r => setDistritos(r.data))
    } else {
      setDistritos([])
    }
    setFiltros(f => ({ ...f, distrito: '' }))
  }, [filtros.provincia])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFiltros(f => ({ ...f, [name]: value }))
  }

  const handleAplicar = () => {
    // Limpia los valores vacíos antes de enviar
    const filtrosLimpios = Object.fromEntries(
      Object.entries(filtros).filter(([, v]) => v !== '')
    )
    onFiltrar(filtrosLimpios)
  }

  const selectClass = "w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
        <FunnelIcon className="h-4 w-4 text-primary-600" /> Filtros rápidos
      </h3>
      <div className="space-y-2">
        {/* Año académico */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Año académico</label>
          <select name="anio" value={filtros.anio} onChange={handleChange} className={selectClass}>
            {anios.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        {/* Departamento */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Departamento</label>
          <select name="departamento" value={filtros.departamento} onChange={handleChange} className={selectClass}>
            <option value="">Todos</option>
            {departamentos.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        {/* Provincia */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Provincia</label>
          <select name="provincia" value={filtros.provincia} onChange={handleChange}
            className={selectClass} disabled={!filtros.departamento}>
            <option value="">Todas</option>
            {provincias.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {/* Distrito */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Distrito</label>
          <select name="distrito" value={filtros.distrito} onChange={handleChange}
            className={selectClass} disabled={!filtros.provincia}>
            <option value="">Todos</option>
            {distritos.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        {/* UGEL */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">UGEL</label>
          <select name="ugel" value={filtros.ugel} onChange={handleChange} className={selectClass}>
            <option value="">Todas</option>
            {ugeles.map(u => <option key={u.cod_ugel} value={u.cod_ugel}>{u.nombre}</option>)}
          </select>
        </div>

        {/* Nivel educativo */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Nivel educativo</label>
          <select name="nivel" value={filtros.nivel} onChange={handleChange} className={selectClass}>
            <option value="">Todos</option>
            {niveles.filter(n => n.aplica_riesgo).map(n => (
              <option key={n.codigo} value={n.nombre}>{n.nombre}</option>
            ))}
          </select>
        </div>

        {/* Nivel de riesgo (opcional) */}
        {mostrarNivelRiesgo && (
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Nivel de riesgo</label>
            <select name="nivel_riesgo" value={filtros.nivel_riesgo} onChange={handleChange} className={selectClass}>
              <option value="">Todos</option>
              <option value="ALTO">Alto</option>
              <option value="MEDIO">Medio</option>
              <option value="BAJO">Bajo</option>
            </select>
          </div>
        )}

        {/* Botón aplicar */}
        <button
          onClick={handleAplicar}
          className="w-full mt-1 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5"
        >
          <FunnelIcon className="h-4 w-4" /> Aplicar filtros
        </button>
      </div>
    </div>
  )
}
