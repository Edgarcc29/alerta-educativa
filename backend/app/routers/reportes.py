# ============================================================
# routers/reportes.py - Endpoints para la pantalla Reportes
# Genera reportes en formato JSON (para previsualización)
# y en PDF (para descarga). Registra cada reporte en ctl_reporte.
# Plantillas disponibles:
#   1. Resumen ejecutivo
#   2. Instituciones por nivel de riesgo
#   3. Tendencias (retiro, desaprobación, atraso 2021-2024)
#   4. Mapa de riesgo por deserción (datos tabulares)
#   5. Factores asociados al riesgo
# ============================================================

from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from typing import Optional
import json
import io
from datetime import datetime

from app.database import get_db, query_all, query_one
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/reportes", tags=["Reportes"])


def _filtros_where(anio, departamento, provincia, distrito, ugel, nivel, nivel_riesgo=None):
    """Construye cláusula WHERE reutilizable para los reportes."""
    conds = ["anio = %s"]
    params = [anio]
    if departamento:
        conds.append("departamento = %s"); params.append(departamento)
    if provincia:
        conds.append("provincia = %s"); params.append(provincia)
    if distrito:
        conds.append("distrito = %s"); params.append(distrito)
    if ugel:
        conds.append("cod_ugel = %s"); params.append(ugel)
    if nivel:
        conds.append("nivel = %s"); params.append(nivel)
    if nivel_riesgo:
        conds.append("nivel_riesgo = %s"); params.append(nivel_riesgo)
    return " AND ".join(conds), tuple(params)


def _registrar_reporte(conn, id_usuario, tipo, parametros, formato, ruta_archivo=""):
    """
    Guarda en ctl_reporte un registro de cada reporte generado.
    - La columna 'tipo' acepta: INSTITUCION | DISTRITO | CONJUNTO
      (mapeamos el nombre interno del reporte a uno de esos valores del ENUM)
    - La columna se llama 'ruta_archivo' (no 'ruta')
    """
    # Mapea el nombre de la plantilla al valor ENUM que acepta la tabla
    tipo_enum_map = {
        "resumen_ejecutivo": "CONJUNTO",
        "por_nivel_riesgo":  "CONJUNTO",
        "tendencias":        "CONJUNTO",
        "mapa_riesgo":       "DISTRITO",
        "factores":          "CONJUNTO",
    }
    tipo_db = tipo_enum_map.get(tipo, "CONJUNTO")

    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO ctl_reporte
               (id_usuario, tipo, parametros, formato, ruta_archivo, fecha_generacion)
           VALUES (%s, %s, %s, %s, %s, NOW())""",
        (id_usuario, tipo_db, json.dumps(parametros), formato, ruta_archivo)
    )
    conn.commit()
    cursor.close()


# ─── Endpoint principal: datos del reporte en JSON ───────────────────────────

@router.get("/datos/{tipo}", summary="Datos de un reporte según plantilla")
def get_datos_reporte(
    tipo: str,
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
    Devuelve los datos del reporte según la plantilla solicitada.
    tipos válidos: resumen_ejecutivo | por_nivel_riesgo | tendencias | mapa_riesgo | factores
    """
    where, params = _filtros_where(anio, departamento, provincia, distrito, ugel, nivel, nivel_riesgo)
    datos = {}

    if tipo == "resumen_ejecutivo":
        # Totales generales y tasas promedio
        datos["resumen"] = query_one(conn, f"""
            SELECT COUNT(*) AS total_instituciones,
                   SUM(total_estudiantes) AS total_estudiantes,
                   SUM(nivel_riesgo='BAJO') AS riesgo_bajo,
                   SUM(nivel_riesgo='MEDIO') AS riesgo_medio,
                   SUM(nivel_riesgo='ALTO') AS riesgo_alto,
                   ROUND(AVG(tasa_desaprobacion),2) AS prom_desaprobacion,
                   ROUND(AVG(tasa_retiro),2) AS prom_retiro,
                   ROUND(AVG(tasa_atraso),2) AS prom_atraso,
                   ROUND(AVG(tasa_desercion_distrital),2) AS prom_desercion
            FROM vw_institucion_riesgo WHERE {where}
        """, params)
        # Top 10 instituciones de mayor riesgo
        datos["top_riesgo"] = query_all(conn, f"""
            SELECT nombre, distrito, nivel, nivel_riesgo, puntaje_reglas,
                   tasa_retiro, tasa_desaprobacion
            FROM vw_institucion_riesgo WHERE {where}
            ORDER BY puntaje_reglas DESC LIMIT 10
        """, params)

    elif tipo == "por_nivel_riesgo":
        # Listado completo agrupado por nivel de riesgo
        datos["instituciones"] = query_all(conn, f"""
            SELECT nombre, distrito, nivel, gestion,
                   nivel_riesgo, puntaje_reglas,
                   tasa_retiro, tasa_desaprobacion, tasa_atraso, tasa_desercion_distrital,
                   factores
            FROM vw_institucion_riesgo WHERE {where}
            ORDER BY FIELD(nivel_riesgo,'ALTO','MEDIO','BAJO'), puntaje_reglas DESC
        """, params)

    elif tipo == "tendencias":
        # Evolución 2021-2024 (sin filtro de año, queremos la serie completa)
        conds_sin_anio = []
        params_sin_anio = []
        if departamento:
            conds_sin_anio.append("departamento = %s"); params_sin_anio.append(departamento)
        if provincia:
            conds_sin_anio.append("provincia = %s"); params_sin_anio.append(provincia)
        if distrito:
            conds_sin_anio.append("distrito = %s"); params_sin_anio.append(distrito)
        if nivel:
            conds_sin_anio.append("nivel = %s"); params_sin_anio.append(nivel)

        w2 = ("WHERE " + " AND ".join(conds_sin_anio)) if conds_sin_anio else ""
        datos["tendencias"] = query_all(conn, f"""
            SELECT anio,
                   ROUND(SUM(desaprobados)*100/NULLIF(SUM(total_estudiantes),0),2) AS tasa_desaprobacion,
                   ROUND(SUM(retirados)*100/NULLIF(SUM(total_estudiantes),0),2) AS tasa_retiro,
                   ROUND(SUM(atraso)*100/NULLIF(SUM(total_estudiantes),0),2) AS tasa_atraso
            FROM vw_institucion_riesgo {w2}
            GROUP BY anio ORDER BY anio
        """, tuple(params_sin_anio))

    elif tipo == "mapa_riesgo":
        # Datos tabulares para el reporte de mapa por distrito
        datos["por_distrito"] = query_all(conn, f"""
            SELECT distrito, departamento,
                   COUNT(*) AS total,
                   SUM(nivel_riesgo='ALTO') AS alto,
                   SUM(nivel_riesgo='MEDIO') AS medio,
                   SUM(nivel_riesgo='BAJO') AS bajo,
                   ROUND(AVG(tasa_desercion_distrital),2) AS tasa_desercion_prom
            FROM vw_institucion_riesgo WHERE {where}
            GROUP BY distrito, departamento
            ORDER BY alto DESC, medio DESC
        """, params)

    elif tipo == "factores":
        # Factores asociados al riesgo por institución
        datos["instituciones"] = query_all(conn, f"""
            SELECT nombre, distrito, nivel, nivel_riesgo,
                   puntaje_reglas, factores,
                   zona_rural, n_iiee_distrito,
                   tasa_retiro, tasa_desaprobacion, tasa_atraso, tasa_desercion_distrital
            FROM vw_institucion_riesgo
            WHERE {where} AND nivel_riesgo IN ('ALTO','MEDIO')
            ORDER BY puntaje_reglas DESC
        """, params)

    else:
        raise HTTPException(status_code=400, detail=f"Tipo de reporte '{tipo}' no válido")

    # Registra el reporte en la base de datos
    parametros_log = {
        "anio": anio, "departamento": departamento, "provincia": provincia,
        "distrito": distrito, "ugel": ugel, "nivel": nivel
    }
    _registrar_reporte(conn, current_user.get("id"), tipo, parametros_log, "JSON")

    return {"tipo": tipo, "anio": anio, "generado_en": datetime.now().isoformat(), **datos}


# ─── Descarga en PDF ─────────────────────────────────────────────────────────

@router.get("/pdf/{tipo}", summary="Descarga el reporte en PDF")
def descargar_pdf(
    tipo: str,
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
    Genera y descarga el reporte en formato PDF usando ReportLab.
    El archivo se genera en memoria y se envía como respuesta de descarga.
    """
    try:
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.platypus import (
            SimpleDocTemplate, Table, TableStyle, Paragraph,
            Spacer, HRFlowable
        )
    except ImportError:
        raise HTTPException(status_code=500, detail="ReportLab no instalado")

    # Obtiene los datos usando la misma lógica que el endpoint JSON
    where, params = _filtros_where(anio, departamento, provincia, distrito, ugel, nivel, nivel_riesgo)

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=landscape(A4),
                             leftMargin=1.5*cm, rightMargin=1.5*cm,
                             topMargin=2*cm, bottomMargin=1.5*cm)

    estilos = getSampleStyleSheet()
    titulo_estilo = ParagraphStyle('titulo', parent=estilos['Heading1'],
                                   fontSize=16, textColor=colors.HexColor('#1a56db'))
    subtitulo_estilo = ParagraphStyle('subtitulo', parent=estilos['Normal'],
                                      fontSize=10, textColor=colors.grey)

    titulos_reporte = {
        "resumen_ejecutivo": "Resumen Ejecutivo",
        "por_nivel_riesgo": "Instituciones por Nivel de Riesgo",
        "tendencias": "Tendencias de Deserción",
        "mapa_riesgo": "Mapa de Riesgo por Deserción",
        "factores": "Factores Asociados al Riesgo",
    }
    nombre_tipo = titulos_reporte.get(tipo, tipo)

    elementos = []
    elementos.append(Paragraph("🏫 ALERTA EDUCATIVA", titulo_estilo))
    elementos.append(Paragraph(f"{nombre_tipo} — Año {anio}", subtitulo_estilo))
    filtro_txt = " | ".join(filter(None, [departamento, provincia, distrito]))
    if filtro_txt:
        elementos.append(Paragraph(f"Filtro: {filtro_txt}", subtitulo_estilo))
    elementos.append(Spacer(1, 0.4*cm))
    elementos.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#1a56db')))
    elementos.append(Spacer(1, 0.4*cm))

    # ── Genera contenido según el tipo ──────────────────────────────
    color_alto  = colors.HexColor('#fde8e8')
    color_medio = colors.HexColor('#fef3c7')
    color_bajo  = colors.HexColor('#def7ec')
    color_header = colors.HexColor('#1a56db')

    def tabla_estilo_base(n_cols):
        return TableStyle([
            ('BACKGROUND', (0, 0), (n_cols-1, 0), color_header),
            ('TEXTCOLOR',  (0, 0), (n_cols-1, 0), colors.white),
            ('FONTNAME',   (0, 0), (n_cols-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE',   (0, 0), (-1, -1), 8),
            ('GRID',       (0, 0), (-1, -1), 0.3, colors.grey),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f9fafb')]),
            ('ALIGN',      (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN',     (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 4),
            ('RIGHTPADDING', (0, 0), (-1, -1), 4),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ])

    if tipo in ("resumen_ejecutivo", "por_nivel_riesgo", "factores"):
        filas = query_all(conn, f"""
            SELECT nombre, distrito, nivel, gestion,
                   nivel_riesgo, ROUND(puntaje_reglas/10,1) AS puntaje,
                   tasa_retiro, tasa_desaprobacion, tasa_atraso, factores
            FROM vw_institucion_riesgo WHERE {where}
            ORDER BY FIELD(nivel_riesgo,'ALTO','MEDIO','BAJO'), puntaje_reglas DESC
            LIMIT 100
        """, params)

        encabezado = ['Institución', 'Distrito', 'Nivel', 'Riesgo', 'Puntaje',
                      'Retiro%', 'Desap%', 'Atraso%', 'Factores']
        data_tabla = [encabezado]
        for f in filas:
            data_tabla.append([
                str(f['nombre'])[:40], str(f['distrito'])[:20],
                str(f['nivel']), str(f['nivel_riesgo']),
                str(f['puntaje']),
                str(f['tasa_retiro']), str(f['tasa_desaprobacion']),
                str(f['tasa_atraso']), str(f['factores'] or '')[:50]
            ])

        t = Table(data_tabla, repeatRows=1,
                  colWidths=[7*cm, 3.5*cm, 2.5*cm, 1.8*cm, 2*cm, 1.8*cm, 1.8*cm, 1.8*cm, 6*cm])
        estilo = tabla_estilo_base(9)
        # Colorea filas según nivel de riesgo
        for i, fila in enumerate(data_tabla[1:], start=1):
            riesgo = fila[3]
            c = color_alto if riesgo == 'ALTO' else (color_medio if riesgo == 'MEDIO' else color_bajo)
            estilo.add('BACKGROUND', (0, i), (-1, i), c)
        t.setStyle(estilo)
        elementos.append(t)

    elif tipo == "tendencias":
        conds2, params2 = [], []
        if departamento: conds2.append("departamento = %s"); params2.append(departamento)
        if nivel: conds2.append("nivel = %s"); params2.append(nivel)
        w2 = ("WHERE " + " AND ".join(conds2)) if conds2 else ""
        filas = query_all(conn, f"""
            SELECT anio,
                   ROUND(SUM(desaprobados)*100/NULLIF(SUM(total_estudiantes),0),2) AS desap,
                   ROUND(SUM(retirados)*100/NULLIF(SUM(total_estudiantes),0),2) AS retiro,
                   ROUND(SUM(atraso)*100/NULLIF(SUM(total_estudiantes),0),2) AS atraso
            FROM vw_institucion_riesgo {w2}
            GROUP BY anio ORDER BY anio
        """, tuple(params2))
        encabezado = ['Año', 'Tasa Desaprobación (%)', 'Tasa Retiro (%)', 'Tasa Atraso (%)']
        data_tabla = [encabezado] + [[str(f['anio']), str(f['desap']), str(f['retiro']), str(f['atraso'])] for f in filas]
        t = Table(data_tabla, colWidths=[4*cm, 6*cm, 6*cm, 6*cm])
        t.setStyle(tabla_estilo_base(4))
        elementos.append(t)

    elif tipo == "mapa_riesgo":
        filas = query_all(conn, f"""
            SELECT distrito, departamento,
                   COUNT(*) AS total,
                   SUM(nivel_riesgo='ALTO') AS alto,
                   SUM(nivel_riesgo='MEDIO') AS medio,
                   SUM(nivel_riesgo='BAJO') AS bajo,
                   ROUND(AVG(tasa_desercion_distrital),2) AS desercion_prom
            FROM vw_institucion_riesgo WHERE {where}
            GROUP BY distrito, departamento
            ORDER BY alto DESC, medio DESC
        """, params)
        encabezado = ['Distrito', 'Departamento', 'Total IEI', 'Alto Riesgo', 'Medio Riesgo', 'Bajo Riesgo', 'Deserción Prom%']
        data_tabla = [encabezado] + [[str(f['distrito']), str(f['departamento']),
                      str(f['total']), str(f['alto']), str(f['medio']), str(f['bajo']), str(f['desercion_prom'])] for f in filas]
        t = Table(data_tabla, repeatRows=1,
                  colWidths=[4.5*cm, 4.5*cm, 2.5*cm, 2.5*cm, 2.5*cm, 2.5*cm, 3.5*cm])
        t.setStyle(tabla_estilo_base(7))
        elementos.append(t)

    elementos.append(Spacer(1, 0.5*cm))
    elementos.append(Paragraph(
        f"Generado el {datetime.now().strftime('%d/%m/%Y %H:%M')} por {current_user.get('nombre','—')} — Alerta Educativa",
        subtitulo_estilo
    ))

    doc.build(elementos)
    buffer.seek(0)

    nombre_archivo = f"reporte_{tipo}_{anio}.pdf"
    _registrar_reporte(conn, current_user.get("id"), tipo,
                       {"anio": anio, "departamento": departamento}, "PDF", nombre_archivo)

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={nombre_archivo}"}
    )


@router.get("/historial", summary="Historial de reportes generados")
def get_historial(
    conn=Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Devuelve el historial de reportes generados por el usuario actual."""
    return query_all(conn,
        "SELECT id_reporte, tipo, parametros, formato, fecha_generacion "
        "FROM ctl_reporte WHERE id_usuario = %s ORDER BY fecha_generacion DESC LIMIT 20",
        (current_user.get("id"),)
    )
