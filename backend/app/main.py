# ============================================================
# main.py - Punto de entrada de la aplicación FastAPI
# Registra todos los routers y configura CORS para permitir
# que el frontend (React en localhost:5173) consuma la API.
# ============================================================

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, dashboard, instituciones, mapa, reportes, filtros, ml

# Crea la instancia principal de FastAPI
app = FastAPI(
    title="Alerta Educativa - API",
    description="Sistema de Alerta Temprana de deserción escolar para la UGEL",
    version="1.0.0",
)

# ─── Configuración CORS ──────────────────────────────────────────────────────
# Permite que el frontend React (que corre en otro puerto) llame a la API.
# En producción, reemplaza "*" por el dominio real del frontend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Registro de routers ─────────────────────────────────────────────────────
# Cada router agrupa los endpoints de una pantalla o funcionalidad
app.include_router(auth.router)
app.include_router(filtros.router)
app.include_router(dashboard.router)
app.include_router(instituciones.router)
app.include_router(mapa.router)
app.include_router(reportes.router)
app.include_router(ml.router)


# ─── Ruta de prueba ──────────────────────────────────────────────────────────
@app.get("/", tags=["Inicio"])
def raiz():
    """Verifica que el servidor está corriendo."""
    return {"mensaje": "API de Alerta Educativa funcionando correctamente ✓"}
