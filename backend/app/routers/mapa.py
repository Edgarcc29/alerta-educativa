# ============================================================
# routers/mapa.py - Endpoints para la pantalla Mapa de riesgo
# Devuelve las instituciones con coordenadas para mostrar en el mapa,
# coloreadas según su nivel de riesgo (BAJO=verde, MEDIO=amarillo, ALTO=rojo).
# NOTA: Las coordenadas actuales son simuladas (coord_simulada = 1).
# ============================================================

from fastapi import APIRouter, Depends, Query
from typing import Optional

from app.database import get_db, query_all, query_one
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/mapa", tags=["Mapa de riesgo"])


@router.get("", summary="Instituciones con coordenadas para el mapa")
def get_mapa(
    anio: int = Query(2024),
    departamento: Optional[str] = Query(None),
    provincia: Optional[str] = Query(None),
    distrito: Optional[str] = Query(None),
    ugel: Optional[int] = Query(None),
    nivel: Optional[str] = Query(None),
    nivel_riesgo: Optional[str] = Query(None),
    conn=Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Devuelve las instituciones con latitud, longitud y nivel de riesgo
    para mostrar los marcadores en el mapa.
    Para evitar sobrecargar el mapa (hay ~50 mil instituciones),
    es obligatorio filtrar por departamento u otro campo.
    """
    condiciones = ["anio = %s", "latitud IS NOT NULL"]
    params = [anio]

    if departamento:
        condiciones.append("departamento = %s")
        params.append(departamento)
    if provincia:
        condiciones.append("provincia = %s")
        params.append(provincia)
    if distrito:
        condiciones.append("distrito = %s")
        params.append(distrito)
    if ugel:
        condiciones.append("cod_ugel = %s")
        params.append(ugel)
    if nivel:
        condiciones.append("nivel = %s")
        params.append(nivel)
    if nivel_riesgo:
        condiciones.append("nivel_riesgo = %s")
        params.append(nivel_riesgo)

    where = " AND ".join(condiciones)

    sql = f"""
        SELECT
            id_institucion, cod_mod, nombre, nivel, gestion,
            departamento, provincia, distrito, ugel,
            latitud, longitud, coord_simulada,
            nivel_riesgo, puntaje_reglas,
            tasa_desercion_distrital, tasa_retiro, tasa_desaprobacion,
            total_estudiantes, factores
        FROM vw_institucion_riesgo
        WHERE {where}
        ORDER BY puntaje_reglas DESC
    """
    marcadores = query_all(conn, sql, tuple(params))

    # Convierte los decimales a float para que JSON los serialice correctamente
    for m in marcadores:
        m["latitud"] = float(m["latitud"]) if m["latitud"] else None
        m["longitud"] = float(m["longitud"]) if m["longitud"] else None

    return marcadores


@router.get("/resumen", summary="Resumen del área filtrada para el panel lateral del mapa")
def get_resumen_mapa(
    anio: int = Query(2024),
    departamento: Optional[str] = Query(None),
    provincia: Optional[str] = Query(None),
    distrito: Optional[str] = Query(None),
    ugel: Optional[int] = Query(None),
    nivel: Optional[str] = Query(None),
    conn=Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Devuelve el resumen estadístico del área filtrada:
    total de instituciones y conteo por nivel de riesgo.
    Alimenta el panel lateral derecho del mapa.
    """
    condiciones = ["anio = %s"]
    params = [anio]

    if departamento:
        condiciones.append("departamento = %s")
        params.append(departamento)
    if provincia:
        condiciones.append("provincia = %s")
        params.append(provincia)
    if distrito:
        condiciones.append("distrito = %s")
        params.append(distrito)
    if ugel:
        condiciones.append("cod_ugel = %s")
        params.append(ugel)
    if nivel:
        condiciones.append("nivel = %s")
        params.append(nivel)

    where = " AND ".join(condiciones)

    resumen = query_one(conn, f"""
        SELECT
            COUNT(*)                       AS total,
            SUM(nivel_riesgo = 'BAJO')     AS riesgo_bajo,
            SUM(nivel_riesgo = 'MEDIO')    AS riesgo_medio,
            SUM(nivel_riesgo = 'ALTO')     AS riesgo_alto
        FROM vw_institucion_riesgo
        WHERE {where}
    """, tuple(params))

    # Las instituciones en riesgo alto para la lista lateral
    alto_sql = f"""
        SELECT cod_mod, nombre, distrito, puntaje_reglas, tasa_desercion_distrital
        FROM vw_institucion_riesgo
        WHERE {where} AND nivel_riesgo = 'ALTO'
        ORDER BY puntaje_reglas DESC
        LIMIT 10
    """
    instituciones_alto = query_all(conn, alto_sql, tuple(params))

    return {
        "resumen": resumen,
        "instituciones_alto_riesgo": instituciones_alto
    }
