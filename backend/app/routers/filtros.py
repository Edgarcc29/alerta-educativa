# ============================================================
# routers/filtros.py - Endpoints para poblar los desplegables
# Devuelve las opciones disponibles para los filtros de cada pantalla:
# departamentos, provincias, distritos, UGELs, niveles y años.
# ============================================================

from fastapi import APIRouter, Depends, Query
from app.database import get_db, query_all

router = APIRouter(prefix="/api/filtros", tags=["Filtros"])


@router.get("/departamentos", summary="Lista de departamentos")
def get_departamentos(conn=Depends(get_db)):
    """Devuelve todos los departamentos disponibles en la base de datos."""
    filas = query_all(
        conn,
        "SELECT DISTINCT departamento FROM dim_ubicacion "
        "WHERE departamento IS NOT NULL ORDER BY departamento"
    )
    return [f["departamento"] for f in filas]


@router.get("/provincias", summary="Provincias de un departamento")
def get_provincias(
    departamento: str = Query(..., description="Nombre del departamento"),
    conn=Depends(get_db)
):
    """Devuelve las provincias del departamento seleccionado."""
    filas = query_all(
        conn,
        "SELECT DISTINCT provincia FROM dim_ubicacion "
        "WHERE departamento = %s ORDER BY provincia",
        (departamento,)
    )
    return [f["provincia"] for f in filas]


@router.get("/distritos", summary="Distritos de una provincia")
def get_distritos(
    departamento: str = Query(..., description="Nombre del departamento"),
    provincia: str = Query(..., description="Nombre de la provincia"),
    conn=Depends(get_db)
):
    """Devuelve los distritos de la provincia seleccionada."""
    filas = query_all(
        conn,
        "SELECT DISTINCT distrito FROM dim_ubicacion "
        "WHERE departamento = %s AND provincia = %s ORDER BY distrito",
        (departamento, provincia)
    )
    return [f["distrito"] for f in filas]


@router.get("/ugeles", summary="Lista de UGELs")
def get_ugeles(
    departamento: str = Query(None, description="Filtrar UGELs por departamento (opcional)"),
    conn=Depends(get_db)
):
    """
    Devuelve las UGELs disponibles.
    Si se pasa departamento, filtra solo las UGELs de ese departamento
    usando las instituciones registradas.
    """
    if departamento:
        filas = query_all(
            conn,
            "SELECT DISTINCT u.cod_ugel, u.nombre "
            "FROM dim_ugel u "
            "JOIN dim_institucion i ON i.cod_ugel = u.cod_ugel "
            "JOIN dim_ubicacion ub ON i.ubigeo = ub.ubigeo "
            "WHERE ub.departamento = %s "
            "ORDER BY u.nombre",
            (departamento,)
        )
    else:
        filas = query_all(
            conn,
            "SELECT cod_ugel, nombre FROM dim_ugel ORDER BY nombre"
        )
    return filas


@router.get("/niveles", summary="Niveles educativos")
def get_niveles(conn=Depends(get_db)):
    """Devuelve los niveles educativos; aplica_riesgo indica si tienen clasificación de riesgo."""
    filas = query_all(
        conn,
        "SELECT codigo, nombre, aplica_riesgo FROM dim_nivel ORDER BY id_nivel"
    )
    return filas


@router.get("/anios", summary="Años disponibles")
def get_anios(conn=Depends(get_db)):
    """Devuelve los años disponibles en la base de datos."""
    filas = query_all(
        conn,
        "SELECT anio FROM dim_periodo ORDER BY anio DESC"
    )
    return [f["anio"] for f in filas]
