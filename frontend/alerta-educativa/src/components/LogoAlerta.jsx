// ============================================================
// components/LogoAlerta.jsx
// Logo SVG vectorial propio de la plataforma Alerta Educativa.
// Reemplaza los emojis 🏫 y 🎓 por un ícono limpio y moderno.
// Props:
//   size   → tamaño en px (default 36)
//   color  → color del ícono (default "currentColor")
//   white  → si true usa blanco puro (para fondo azul)
// ============================================================

export default function LogoAlerta({ size = 36, white = false }) {
  const c1 = white ? '#ffffff' : '#1a56db'   // Azul primario o blanco
  const c2 = white ? '#bfdbfe' : '#3b82f6'   // Azul claro o celeste translúcido
  const c3 = white ? '#ffffff' : '#ef4444'   // Alerta roja o blanco

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Alerta Educativa"
    >
      {/* ── Base del edificio escolar ── */}
      <rect x="6" y="18" width="28" height="18" rx="1.5" fill={c1} opacity="0.15" />
      <rect x="8" y="20" width="24" height="16" rx="1" fill={c1} opacity="0.25" />

      {/* ── Techo / triángulo ── */}
      <path d="M4 19 L20 7 L36 19" stroke={c1} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />

      {/* ── Puerta central ── */}
      <rect x="16" y="28" width="8" height="8" rx="1" fill={c1} opacity="0.9" />

      {/* ── Ventanas ── */}
      <rect x="9"  y="23" width="5" height="4" rx="0.8" fill={c2} opacity="0.9" />
      <rect x="26" y="23" width="5" height="4" rx="0.8" fill={c2} opacity="0.9" />

      {/* ── Campana de alerta en la parte superior del techo ── */}
      <circle cx="30" cy="10" r="6" fill={c3} opacity="0.92" />
      {/* Signo de exclamación */}
      <rect x="29.2" y="7" width="1.6" height="3.5" rx="0.8" fill="white" />
      <circle cx="30" cy="12.2" r="0.9" fill="white" />
    </svg>
  )
}
