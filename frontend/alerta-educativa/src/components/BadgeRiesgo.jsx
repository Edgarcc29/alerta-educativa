// ============================================================
// components/BadgeRiesgo.jsx
// Componente pequeño que muestra el nivel de riesgo con color.
// Reutilizado en tablas, tarjetas y el panel de detalle.
// ============================================================

export default function BadgeRiesgo({ nivel }) {
  if (!nivel) return null
  const clases = {
    ALTO:  'badge-alto',
    MEDIO: 'badge-medio',
    BAJO:  'badge-bajo',
  }
  return (
    <span className={clases[nivel] || 'bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-semibold'}>
      {nivel}
    </span>
  )
}
