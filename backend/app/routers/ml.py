# ============================================================
# routers/ml.py — Endpoints de Machine Learning
# ============================================================

import os, math
from decimal import Decimal
from fastapi import APIRouter, Depends, Query, HTTPException
from typing import Optional

from app.database import get_db, query_all, query_one
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/ml", tags=["Machine Learning"])

_MODELO_PATH = os.path.join(
    os.path.dirname(__file__), "..", "ml", "modelo_riesgo.joblib"
)


def _to_float(v):
    """Convierte Decimal/None a float serializable por JSON."""
    if v is None: return None
    return float(v)

def _to_int(v):
    """Convierte Decimal/None a int."""
    if v is None: return 0
    return int(v)


# ── 1. Estado ─────────────────────────────────────────────────────────────────

@router.get("/estado")
def get_estado(current_user: dict = Depends(get_current_user)):
    existe = os.path.exists(_MODELO_PATH)
    fecha  = None
    if existe:
        from datetime import datetime
        fecha = datetime.fromtimestamp(os.path.getmtime(_MODELO_PATH)).isoformat()
    return {"modelo_entrenado": existe, "fecha_entrenamiento": fecha}


# ── 2. Años disponibles ───────────────────────────────────────────────────────

@router.get("/anios-disponibles")
def get_anios_ml(conn=Depends(get_db), current_user: dict = Depends(get_current_user)):
    return query_all(conn, """
        SELECT p.anio, COUNT(*) AS registros, 0 AS es_proyeccion
        FROM eval_riesgo e
        JOIN dim_periodo p ON p.id_periodo = e.id_periodo
        WHERE e.metodo = 'ML'
        GROUP BY p.anio ORDER BY p.anio
    """)


# ── 3. Evolución por año ──────────────────────────────────────────────────────

@router.get("/evolucion-riesgo")
def get_evolucion_riesgo(
    departamento: Optional[str] = Query(None),
    conn=Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    conds  = ["e.metodo = 'ML'"]
    params = []
    if departamento:
        conds.append("ub.departamento = %s"); params.append(departamento)

    filas = query_all(conn, f"""
        SELECT
            p.anio,
            COUNT(*)                                AS total,
            SUM(e.nivel_riesgo = 'ALTO')            AS alto,
            SUM(e.nivel_riesgo = 'MEDIO')           AS medio,
            SUM(e.nivel_riesgo = 'BAJO')            AS bajo,
            ROUND(AVG(e.probabilidad_ml) * 100, 2) AS prob_prom_pct
        FROM eval_riesgo e
        JOIN dim_institucion i  ON i.id_institucion = e.id_institucion
        JOIN dim_ubicacion ub   ON ub.id_ubicacion  = i.id_ubicacion
        JOIN dim_nivel n        ON n.id_nivel        = i.id_nivel
        JOIN dim_periodo p      ON p.id_periodo      = e.id_periodo
        WHERE {" AND ".join(conds)}
        GROUP BY p.anio
        ORDER BY p.anio
    """, tuple(params))

    resultado = []
    for f in filas:
        total = _to_int(f["total"]) or 1
        alto  = _to_int(f["alto"])
        medio = _to_int(f["medio"])
        bajo  = _to_int(f["bajo"])
        resultado.append({
            "anio":          int(f["anio"]),
            "es_proyeccion": 0,
            "total":         total,
            "alto":          alto,
            "medio":         medio,
            "bajo":          bajo,
            "pct_alto":      round(alto  * 100 / total, 1),
            "pct_medio":     round(medio * 100 / total, 1),
            "pct_bajo":      round(bajo  * 100 / total, 1),
            "prob_prom_pct": _to_float(f["prob_prom_pct"]),
        })
    return resultado


# ── 4. Resumen por nivel ──────────────────────────────────────────────────────

@router.get("/resumen")
def get_resumen(conn=Depends(get_db), current_user: dict = Depends(get_current_user)):
    filas = query_all(conn, """
        SELECT p.anio, e.nivel_riesgo,
               COUNT(*) AS cantidad,
               ROUND(AVG(e.probabilidad_ml), 4) AS prob_promedio
        FROM eval_riesgo e
        JOIN dim_periodo p ON p.id_periodo = e.id_periodo
        WHERE e.metodo = 'ML'
        GROUP BY p.anio, e.nivel_riesgo
        ORDER BY p.anio, FIELD(e.nivel_riesgo, 'ALTO', 'MEDIO', 'BAJO')
    """)
    return [{
        "anio":          int(f["anio"]),
        "es_proyeccion": 0,
        "nivel_riesgo":  f["nivel_riesgo"],
        "cantidad":      _to_int(f["cantidad"]),
        "prob_promedio": _to_float(f["prob_promedio"]),
    } for f in filas]


# ── 5. Top N instituciones ────────────────────────────────────────────────────

@router.get("/top-riesgo")
def get_top_riesgo(
    limite: int = Query(10, ge=1, le=100),
    conn=Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    filas = query_all(conn, """
        SELECT i.cod_mod, i.nombre, n.nombre AS nivel,
               ub.departamento, ub.distrito,
               p.anio, e.probabilidad_ml, e.nivel_riesgo, e.puntaje
        FROM eval_riesgo e
        JOIN dim_institucion i  ON i.id_institucion = e.id_institucion
        JOIN dim_ubicacion ub   ON ub.id_ubicacion  = i.id_ubicacion
        JOIN dim_nivel n        ON n.id_nivel        = i.id_nivel
        JOIN dim_periodo p      ON p.id_periodo      = e.id_periodo
        WHERE e.metodo = 'ML'
          AND p.anio = (SELECT MAX(anio) FROM dim_periodo)
        ORDER BY e.probabilidad_ml DESC
        LIMIT %s
    """, (limite,))
    return [{
        "cod_mod":        f["cod_mod"],
        "nombre":         f["nombre"],
        "nivel":          f["nivel"],
        "departamento":   f["departamento"],
        "distrito":       f["distrito"],
        "anio":           int(f["anio"]),
        "probabilidad_ml":_to_float(f["probabilidad_ml"]),
        "nivel_riesgo":   f["nivel_riesgo"],
        "puntaje":        _to_float(f["puntaje"]),
    } for f in filas]


# ── 6. Predicciones paginadas (año real) ──────────────────────────────────────

@router.get("/predicciones")
def get_predicciones(
    anio: Optional[int] = Query(None),
    nivel_riesgo: Optional[str] = Query(None),
    departamento: Optional[str] = Query(None),
    pagina: int = Query(1, ge=1),
    por_pagina: int = Query(15, ge=1, le=100),
    conn=Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    conds  = ["e.metodo = 'ML'"]
    params = []
    if anio:
        conds.append("p.anio = %s"); params.append(anio)
    if nivel_riesgo:
        conds.append("e.nivel_riesgo = %s"); params.append(nivel_riesgo)
    if departamento:
        conds.append("ub.departamento = %s"); params.append(departamento)
    where = " AND ".join(conds)

    joins = """
        FROM eval_riesgo e
        JOIN dim_institucion i  ON i.id_institucion = e.id_institucion
        JOIN dim_ubicacion ub   ON ub.id_ubicacion  = i.id_ubicacion
        JOIN dim_nivel n        ON n.id_nivel        = i.id_nivel
        JOIN dim_periodo p      ON p.id_periodo      = e.id_periodo
    """

    total_row  = query_one(conn, f"SELECT COUNT(*) AS total {joins} WHERE {where}", tuple(params))
    total      = _to_int(total_row["total"]) if total_row else 0
    total_pags = math.ceil(total / por_pagina) if total > 0 else 1
    offset     = (pagina - 1) * por_pagina

    datos = query_all(conn, f"""
        SELECT i.cod_mod, i.nombre, n.nombre AS nivel, i.area,
               ub.departamento, ub.provincia, ub.distrito,
               p.anio, 0 AS es_proyeccion,
               e.probabilidad_ml, e.nivel_riesgo, e.puntaje
        {joins} WHERE {where}
        ORDER BY e.probabilidad_ml DESC
        LIMIT %s OFFSET %s
    """, tuple(params) + (por_pagina, offset))

    return {
        "total": total, "pagina": pagina,
        "por_pagina": por_pagina, "total_paginas": total_pags,
        "datos": [{
            "cod_mod":         f["cod_mod"],
            "nombre":          f["nombre"],
            "nivel":           f["nivel"],
            "area":            f["area"],
            "departamento":    f["departamento"],
            "provincia":       f["provincia"],
            "distrito":        f["distrito"],
            "anio":            int(f["anio"]),
            "es_proyeccion":   0,
            "probabilidad_ml": _to_float(f["probabilidad_ml"]),
            "nivel_riesgo":    f["nivel_riesgo"],
            "puntaje":         _to_float(f["puntaje"]),
        } for f in datos]
    }


# ── 7. Resumen proyección futura (on-demand) ──────────────────────────────────

@router.get("/resumen-proyeccion")
def get_resumen_proyeccion(
    anio: int = Query(...),
    conn=Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    vacio = {"anio": anio, "alto": 0, "medio": 0, "bajo": 0, "total": 0,
             "pct_alto": 0.0, "pct_medio": 0.0, "pct_bajo": 0.0}
    if not os.path.exists(_MODELO_PATH):
        return vacio
    try:
        from app.ml.modelo import cargar_modelo_guardado, cargar_datos_prediccion, proyectar_futuros
        pipeline  = cargar_modelo_guardado()
        df_base   = cargar_datos_prediccion()
        anio_base = int(df_base['anio'].iloc[0]) if len(df_base) > 0 else 2024
        if anio <= anio_base:
            return vacio
        df_proy = proyectar_futuros(pipeline, df_base, [anio])
        alto  = int((df_proy['nivel_riesgo_ml'] == 'ALTO').sum())
        medio = int((df_proy['nivel_riesgo_ml'] == 'MEDIO').sum())
        bajo  = int((df_proy['nivel_riesgo_ml'] == 'BAJO').sum())
        total = len(df_proy)
        return {
            "anio": anio, "total": total,
            "alto": alto, "medio": medio, "bajo": bajo,
            "pct_alto":  round(alto  * 100 / total, 1) if total else 0.0,
            "pct_medio": round(medio * 100 / total, 1) if total else 0.0,
            "pct_bajo":  round(bajo  * 100 / total, 1) if total else 0.0,
        }
    except Exception as e:
        return {**vacio, "error": str(e)}


# ── 8. Proyecciones paginadas (on-demand) ─────────────────────────────────────

@router.get("/proyecciones")
def get_proyecciones(
    anio: int = Query(...),
    nivel_riesgo: Optional[str] = Query(None),
    departamento: Optional[str] = Query(None),
    pagina: int = Query(1, ge=1),
    por_pagina: int = Query(15, ge=1, le=100),
    conn=Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    if not os.path.exists(_MODELO_PATH):
        raise HTTPException(status_code=404, detail="Modelo no disponible. Ejecuta ejecutar_ml.py")
    try:
        from app.ml.modelo import cargar_modelo_guardado, cargar_datos_prediccion, proyectar_futuros
        pipeline  = cargar_modelo_guardado()
        df_base   = cargar_datos_prediccion()
        anio_base = int(df_base['anio'].iloc[0]) if len(df_base) > 0 else 2024
        if anio <= anio_base:
            raise HTTPException(status_code=400, detail=f"El año debe ser mayor a {anio_base}")
        df_proy = proyectar_futuros(pipeline, df_base, [anio])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    ids_list     = df_proy['id_institucion'].tolist()
    placeholders = ",".join(["%s"] * len(ids_list))
    instituciones = query_all(conn, f"""
        SELECT i.id_institucion, i.cod_mod, i.nombre,
               n.nombre AS nivel, i.area,
               ub.departamento, ub.provincia, ub.distrito
        FROM dim_institucion i
        JOIN dim_nivel n      ON n.id_nivel       = i.id_nivel
        JOIN dim_ubicacion ub ON ub.id_ubicacion  = i.id_ubicacion
        WHERE i.id_institucion IN ({placeholders})
    """, tuple(ids_list))
    inst_map = {r['id_institucion']: r for r in instituciones}

    resultado = []
    for _, row in df_proy.iterrows():
        inst  = inst_map.get(int(row['id_institucion']), {})
        nivel = str(row['nivel_riesgo_ml'])
        if nivel_riesgo and nivel != nivel_riesgo: continue
        if departamento and inst.get('departamento') != departamento: continue
        resultado.append({
            **{k: v for k, v in inst.items() if k != 'id_institucion'},
            "anio":            anio,
            "es_proyeccion":   1,
            "nivel_riesgo":    nivel,
            "probabilidad_ml": float(row['probabilidad_ml']),
        })

    resultado.sort(key=lambda x: x['probabilidad_ml'], reverse=True)
    total      = len(resultado)
    total_pags = math.ceil(total / por_pagina) if total > 0 else 1
    offset     = (pagina - 1) * por_pagina
    return {"total": total, "pagina": pagina,
            "por_pagina": por_pagina, "total_paginas": total_pags,
            "datos": resultado[offset: offset + por_pagina]}
