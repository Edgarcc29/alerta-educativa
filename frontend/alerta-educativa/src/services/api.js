// ============================================================
// services/api.js - Cliente HTTP centralizado con Axios
// Todas las llamadas al backend pasan por aquí.
// Se encarga de:
//   - Agregar el token JWT a cada petición automáticamente
//   - Redirigir al login si el token expiró (error 401)
// ============================================================

import axios from 'axios'

// URL base del backend (el proxy de Vite redirige /api → localhost:8000)
const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// ── Interceptor de SOLICITUD ─────────────────────────────────────────────────
// Agrega el token JWT al header de cada petición antes de enviarla
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Interceptor de RESPUESTA ─────────────────────────────────────────────────
// Si el servidor devuelve 401 (no autorizado), limpia la sesión y redirige al login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('usuario')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// ── Funciones de autenticación ───────────────────────────────────────────────
export const authAPI = {
  login: (usuario, password) => {
    // El endpoint de FastAPI usa form-data, no JSON
    const form = new URLSearchParams()
    form.append('username', usuario)
    form.append('password', password)
    return api.post('/auth/login', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    })
  },
  logout: () => api.post('/auth/logout'),
  me:     () => api.get('/auth/me'),
}

// ── Funciones del Dashboard ──────────────────────────────────────────────────
export const dashboardAPI = {
  kpi:              (params) => api.get('/dashboard/kpi', { params }),
  distribucionRiesgo: (params) => api.get('/dashboard/distribucion-riesgo', { params }),
  evolucion:        (params) => api.get('/dashboard/evolucion', { params }),
  mayorAtencion:    (params) => api.get('/dashboard/mayor-atencion', { params }),
  iieeDepartamento: ()       => api.get('/dashboard/iiee-por-departamento'),
}

// ── Funciones de Instituciones ───────────────────────────────────────────────
export const institucionesAPI = {
  listar:    (params) => api.get('/instituciones', { params }),
  detalle:   (cod_mod, anio) => api.get(`/instituciones/${cod_mod}`, { params: { anio } }),
  evolucion: (cod_mod) => api.get(`/instituciones/${cod_mod}/evolucion`),
  ranking:   (params) => api.get('/instituciones/ranking', { params }),
}

// ── Funciones del Mapa ───────────────────────────────────────────────────────
export const mapaAPI = {
  marcadores: (params) => api.get('/mapa', { params }),
  resumen:    (params) => api.get('/mapa/resumen', { params }),
}

// ── Funciones de Reportes ────────────────────────────────────────────────────
export const reportesAPI = {
  datos:    (tipo, params) => api.get(`/reportes/datos/${tipo}`, { params }),
  historial: ()            => api.get('/reportes/historial'),

  // Descarga el PDF usando Axios para que el token JWT vaya en el header.
  // El backend devuelve bytes binarios (responseType: 'blob') y el frontend
  // crea un enlace temporal en memoria para forzar la descarga en el navegador.
  descargarPDF: async (tipo, params, nombreArchivo) => {
    const respuesta = await api.get(`/reportes/pdf/${tipo}`, {
      params,
      responseType: 'blob',   // Indica a Axios que la respuesta es binaria (PDF)
    })
    // Crea una URL temporal que apunta al blob en memoria del navegador
    const urlBlob = window.URL.createObjectURL(new Blob([respuesta.data], { type: 'application/pdf' }))
    const link = document.createElement('a')
    link.href = urlBlob
    link.setAttribute('download', nombreArchivo)
    document.body.appendChild(link)
    link.click()
    // Limpia el enlace y libera la memoria del blob
    link.remove()
    window.URL.revokeObjectURL(urlBlob)
  }
}

// ── Funciones de Filtros ─────────────────────────────────────────────────────
export const filtrosAPI = {
  departamentos: ()              => api.get('/filtros/departamentos'),
  provincias:    (departamento)  => api.get('/filtros/provincias', { params: { departamento } }),
  distritos:     (dpto, prov)    => api.get('/filtros/distritos', { params: { departamento: dpto, provincia: prov } }),
  ugeles:        (departamento)  => api.get('/filtros/ugeles', { params: { departamento } }),
  niveles:       ()              => api.get('/filtros/niveles'),
  anios:         ()              => api.get('/filtros/anios'),
}

// ── Funciones de Machine Learning ────────────────────────────────────────────
export const mlAPI = {
  estado:            ()       => api.get('/ml/estado'),
  predicciones:      (params) => api.get('/ml/predicciones', { params }),
  resumen:           ()       => api.get('/ml/resumen'),
  topRiesgo:         (params) => api.get('/ml/top-riesgo', { params }),
  evolucionRiesgo:   (params) => api.get('/ml/evolucion-riesgo', { params }),
  aniosDisponibles:  ()       => api.get('/ml/anios-disponibles'),
  // Proyecciones futuras calculadas on-demand desde el modelo
  proyecciones:      (params) => api.get('/ml/proyecciones', { params }),
  resumenProyeccion: (anio)   => api.get('/ml/resumen-proyeccion', { params: { anio } }),
}

export default api
