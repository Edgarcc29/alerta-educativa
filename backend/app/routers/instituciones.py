# ============================================================
# routers/instituciones.py - Endpoints para la pantalla Instituciones
# Provee:
#   - Listado paginado con búsqueda y filtros múltiples
#   - Detalle completo de una institución
#   - Evolución histórica de indicadores de una institución
#   - Ranking de instituciones por puntaje de riesgo
# ============================================================

from fastapi import APIRouter, Depends, Query, HTTPException
from typing import Optional
import math

from app.database import get_db, query_one, query_all
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/instituciones", tags=["Instituciones"])


@router.get("", summary="Listado paginado de instituciones con filtros")
def get_instituciones(
    # Parámetros de búsqueda
    buscar: Optional[str] = Query(None, description="Nombre o código modular"),
    # Filtros geográficos y de clasificación
    departamento: Optional[str] = Query(None),
    provincia: Optional[str] = Query(None),
    distrito: Optional[str] = Query(None),
    ugel: Optional[int] = Query(None),
    nivel: Optional[str] = Query(None),
    gestion: Optional[str] = Query(None, description="Pública o Privada"),
    nivel_riesgo: Optional[str] = Query(None, description="BAJO, MEDIO o ALTO"),
    anio: int = Query(2024),
    # Paginación
    pagina: int = Query(1, ge=1, description="Número de página"),
    por_pagina: int = Query(7, ge=1, le=50, description="Registros por página"),
    conn=Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Retorna el listado de instituciones con búsqueda y filtros combinados.
    La respuesta incluye los datos paginados y el total de resultados
    para que el frontend pueda mostrar los controles de paginación.
    """
    condiciones = ["anio = %s"]
    params = [anio]

    # Búsqueda por nombre o código modular
    if buscar:
        condiciones.append("(nombre LIKE %s OR cod_mod = %s)")
        params.append(f"%{buscar}%")
        # Intentar convertir a número para buscar por cod_mod
        try:
            params.append(int(buscar))
        except ValueError:
            params.append(-1)  # Valor imposible si no es número

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
    if gestion:
        condiciones.append("gestion LIKE %s")
        params.append(f"%{gestion}%")
    if nivel_riesgo:
        condiciones.append("nivel_riesgo = %s")
        params.append(nivel_riesgo)

    where = " AND ".join(condiciones)

    # Cuenta el total de resultados para la paginación
    total_sql = f"SELECT COUNT(*) AS total FROM vw_institucion_riesgo WHERE {where}"
    total_row = query_one(conn, total_sql, tuple(params))
    total = total_row["total"] if total_row else 0
    total_paginas = math.ceil(total / por_pagina) if total > 0 else 1

    # Calcula el desplazamiento (OFFSET) para la paginación
    offset = (pagina - 1) * por_pagina

    # Consulta los datos de la página actual
    data_sql = f"""
        SELECT
            id_institucion, cod_mod, nombre, nivel, gestion,
            es_publica, area, departamento, provincia, distrito,
            ugel, total_estudiantes,
            tasa_desaprobacion, tasa_retiro, tasa_atraso,
            tasa_desercion_distrital, puntaje_reglas,
            nivel_riesgo, factores
        FROM vw_institucion_riesgo
        WHERE {where}
        ORDER BY puntaje_reglas DESC
        LIMIT %s OFFSET %s
    """
    instituciones = query_all(conn, data_sql, tuple(params) + (por_pagina, offset))

    return {
        "total": total,
        "pagina": pagina,
        "por_pagina": por_pagina,
        "total_paginas": total_paginas,
        "datos": instituciones
    }


@router.get("/ranking", summary="Ranking de instituciones por riesgo")
def get_ranking(
    anio: int = Query(2024),
    departamento: Optional[str] = Query(None),
    provincia: Optional[str] = Query(None),
    distrito: Optional[str] = Query(None),
    ugel: Optional[int] = Query(None),
    nivel: Optional[str] = Query(None),
    nivel_riesgo: Optional[str] = Query(None),
    limite: int = Query(20, ge=1, le=100),
    conn=Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Devuelve el ranking de instituciones ordenadas por puntaje de riesgo.
    Útil para el componente de ranking de la pantalla Instituciones y Dashboard.
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
    if nivel_riesgo:
        condiciones.append("nivel_riesgo = %s")
        params.append(nivel_riesgo)

    where = " AND ".join(condiciones)

    sql = f"""
        SELECT nombre, distrito, nivel, puntaje_reglas, nivel_riesgo,
               tasa_retiro, tasa_desaprobacion, tasa_atraso, tasa_desercion_distrital
        FROM vw_institucion_riesgo
        WHERE {where}
        ORDER BY puntaje_reglas DESC
        LIMIT %s
    """
    return query_all(conn, sql, tuple(params) + (limite,))


@router.get("/{cod_mod}", summary="Detalle completo de una institución")
def get_detalle_institucion(
    cod_mod: int,
    anio: int = Query(2024),
    conn=Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Devuelve todos los datos de una institución específica:
    datos generales, ubicación, indicadores académicos y nivel de riesgo.
    """
    datos = query_one(
        conn,
        "SELECT * FROM vw_institucion_riesgo WHERE cod_mod = %s AND anio = %s",
        (cod_mod, anio)
    )
    if not datos:
        raise HTTPException(status_code=404, detail="Institución no encontrada")
    return datos


@router.get("/{cod_mod}/evolucion", summary="Evolución histórica de una institución")
def get_evolucion_institucion(
    cod_mod: int,
    conn=Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Devuelve la serie histórica (2021-2024) de los indicadores de una institución.
    Alimenta la pestaña 'Evolución' del panel de detalle.
    """
    datos = query_all(
        conn,
        """
        SELECT
            anio, total_estudiantes,
            tasa_desaprobacion, tasa_retiro, tasa_atraso,
            tasa_recuperacion, tasa_desercion_distrital,
            puntaje_reglas, nivel_riesgo
        FROM vw_institucion_riesgo
        WHERE cod_mod = %s
        ORDER BY anio
        """,
        (cod_mod,)
    )
    if not datos:
        raise HTTPException(status_code=404, detail="No hay datos para esta institución")
    return datos
