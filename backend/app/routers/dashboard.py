# ============================================================
# routers/dashboard.py - Endpoints para la pantalla Dashboard
# Provee los datos de:
#   - Tarjetas KPI (instituciones, estudiantes, riesgo medio/alto)
#   - Gráfico de dona (distribución por nivel de riesgo)
#   - Gráfico de línea (evolución histórica de indicadores)
#   - Tabla de instituciones que requieren mayor atención
#   - Resumen de cinco indicadores clave
# ============================================================

from fastapi import APIRouter, Depends, Query
from typing import Optional

from app.database import get_db, query_one, query_all
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


def _build_where(anio, departamento, provincia, distrito, ugel, nivel):
    """
    Construye la cláusula WHERE y la lista de parámetros
    en base a los filtros que el usuario haya seleccionado.
    Los filtros no seleccionados se omiten del WHERE.
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

    return " AND ".join(condiciones), tuple(params)


@router.get("/kpi", summary="KPIs principales del dashboard")
def get_kpi(
    anio: int = Query(2024, description="Año académico"),
    departamento: Optional[str] = Query(None),
    provincia: Optional[str] = Query(None),
    distrito: Optional[str] = Query(None),
    ugel: Optional[int] = Query(None),
    nivel: Optional[str] = Query(None),
    conn=Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Devuelve los valores de las cuatro tarjetas principales:
    - Total de instituciones evaluadas
    - Total de estudiantes
    - Instituciones en riesgo MEDIO y su porcentaje
    - Instituciones en riesgo ALTO y su porcentaje
    También incluye las cinco tasas resumidas.
    """
    where, params = _build_where(anio, departamento, provincia, distrito, ugel, nivel)

    sql = f"""
        SELECT
            COUNT(*)                                                    AS total_instituciones,
            SUM(total_estudiantes)                                      AS total_estudiantes,
            SUM(nivel_riesgo = 'BAJO')                                  AS riesgo_bajo,
            SUM(nivel_riesgo = 'MEDIO')                                 AS riesgo_medio,
            SUM(nivel_riesgo = 'ALTO')                                  AS riesgo_alto,
            ROUND(SUM(desaprobados) * 100.0 /
                NULLIF(SUM(total_estudiantes), 0), 2)                   AS tasa_desaprobacion,
            ROUND(SUM(retirados) * 100.0 /
                NULLIF(SUM(total_estudiantes), 0), 2)                   AS tasa_retiro,
            ROUND(SUM(atraso) * 100.0 /
                NULLIF(SUM(total_estudiantes), 0), 2)                   AS tasa_atraso,
            ROUND(AVG(tasa_desercion_distrital), 2)                     AS tasa_desercion_distrital
        FROM vw_institucion_riesgo
        WHERE {where}
    """
    datos = query_one(conn, sql, params)

    # Calcula los porcentajes respecto al total de instituciones
    total = datos["total_instituciones"] or 1
    datos["pct_riesgo_medio"] = round((datos["riesgo_medio"] or 0) * 100 / total, 1)
    datos["pct_riesgo_alto"] = round((datos["riesgo_alto"] or 0) * 100 / total, 1)

    return datos


@router.get("/distribucion-riesgo", summary="Distribución por nivel de riesgo (dona)")
def get_distribucion_riesgo(
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
    Devuelve el conteo de instituciones por nivel de riesgo
    para alimentar el gráfico de dona del dashboard.
    """
    where, params = _build_where(anio, departamento, provincia, distrito, ugel, nivel)

    sql = f"""
        SELECT nivel_riesgo, COUNT(*) AS cantidad
        FROM vw_institucion_riesgo
        WHERE {where}
        GROUP BY nivel_riesgo
        ORDER BY FIELD(nivel_riesgo, 'ALTO', 'MEDIO', 'BAJO')
    """
    return query_all(conn, sql, params)


@router.get("/evolucion", summary="Evolución histórica de indicadores (línea)")
def get_evolucion(
    departamento: Optional[str] = Query(None),
    provincia: Optional[str] = Query(None),
    distrito: Optional[str] = Query(None),
    ugel: Optional[int] = Query(None),
    nivel: Optional[str] = Query(None),
    conn=Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Devuelve la evolución anual (2021-2024) de las tasas principales
    para alimentar el gráfico de línea del dashboard.
    """
    # Construye filtros excluyendo el año (queremos todos los años)
    condiciones = []
    params = []

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

    where = ("WHERE " + " AND ".join(condiciones)) if condiciones else ""

    sql = f"""
        SELECT
            anio,
            ROUND(SUM(desaprobados) * 100.0 / NULLIF(SUM(total_estudiantes), 0), 2) AS tasa_desaprobacion,
            ROUND(SUM(retirados)    * 100.0 / NULLIF(SUM(total_estudiantes), 0), 2) AS tasa_retiro,
            ROUND(SUM(atraso)       * 100.0 / NULLIF(SUM(total_estudiantes), 0), 2) AS tasa_atraso,
            ROUND(AVG(tasa_desercion_distrital), 2)                                  AS tasa_desercion_distrital
        FROM vw_institucion_riesgo
        {where}
        GROUP BY anio
        ORDER BY anio
    """
    return query_all(conn, sql, tuple(params))


@router.get("/mayor-atencion", summary="Instituciones que requieren mayor atención")
def get_mayor_atencion(
    anio: int = Query(2024),
    departamento: Optional[str] = Query(None),
    provincia: Optional[str] = Query(None),
    distrito: Optional[str] = Query(None),
    ugel: Optional[int] = Query(None),
    nivel: Optional[str] = Query(None),
    limite: int = Query(10, description="Número de instituciones a mostrar"),
    conn=Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Devuelve las instituciones con mayor puntaje de riesgo,
    ordenadas de mayor a menor. Es la tabla inferior del dashboard.
    """
    where, params = _build_where(anio, departamento, provincia, distrito, ugel, nivel)

    sql = f"""
        SELECT
            cod_mod, nombre, distrito, nivel,
            nivel_riesgo, tasa_desercion_distrital,
            tasa_retiro, tasa_desaprobacion, puntaje_reglas
        FROM vw_institucion_riesgo
        WHERE {where}
        ORDER BY puntaje_reglas DESC
        LIMIT %s
    """
    return query_all(conn, sql, params + (limite,))


@router.get("/iiee-por-departamento", summary="Total de IIEE públicas por departamento")
def get_iiee_departamento(
    conn=Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Devuelve el total de IIEE públicas por departamento de todos los niveles.
    Usa la vista vw_iiee_publicas_departamento.
    """
    return query_all(
        conn,
        "SELECT departamento, total_iiee_publicas FROM vw_iiee_publicas_departamento "
        "ORDER BY total_iiee_publicas DESC"
    )
