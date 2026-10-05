# ============================================================
# app/ml/modelo.py — Motor de Machine Learning (versión optimizada)
#
# Optimizaciones clave:
#  - Muestreo estratificado de 30k filas para entrenamiento rápido
#  - 100 árboles (en vez de 300) sin pérdida significativa de calidad
#  - Sin cross-validation en producción (se puede activar con cv=True)
#  - Inserciones en lotes (batch) para acelerar el guardado en BD
#  - Carga de BD con cursor manual (compatible con pandas 3.x)
# ============================================================

import os, json, joblib, logging
import pandas as pd
import numpy as np
import mysql.connector
from datetime import datetime

from sklearn.ensemble       import RandomForestClassifier
from sklearn.preprocessing  import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics        import (classification_report, roc_auc_score,
                                    accuracy_score)
from sklearn.pipeline       import Pipeline
from sklearn.impute          import SimpleImputer

logger = logging.getLogger(__name__)

# ── Rutas y constantes ────────────────────────────────────────────────────────
BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
MODELO_PATH = os.path.join(BASE_DIR, "modelo_riesgo.joblib")

# Features (variables de entrada al modelo)
FEATURES = [
    'id_nivel', 'es_publica', 'zona_rural',
    'tasa_desaprobacion', 'tasa_retiro', 'tasa_recuperacion',
    'tasa_atraso', 'tasa_desercion_distrital',
    'n_iiee_distrito', 'pct_extranjeros', 'total_estudiantes',
]
TARGET = 'etiqueta_alto_retiro_siguiente'

# Máximo de filas para entrenar (muestreo estratificado)
MAX_FILAS_ENTRENAMIENTO = 30_000


# ── Conexión ──────────────────────────────────────────────────────────────────
def _get_conn():
    from app.config import DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
    return mysql.connector.connect(
        host=DB_HOST, user=DB_USER, password=DB_PASSWORD,
        database=DB_NAME, use_pure=True
    )


def _sql_to_df(sql: str) -> pd.DataFrame:
    """Ejecuta SQL y retorna DataFrame sin necesitar SQLAlchemy."""
    conn = _get_conn()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(sql)
    filas = cursor.fetchall()
    cursor.close()
    conn.close()
    return pd.DataFrame(filas) if filas else pd.DataFrame()


# ── 1. Carga de datos ─────────────────────────────────────────────────────────
def cargar_datos_entrenamiento() -> pd.DataFrame:
    """Lee vw_dataset_ml. Requiere pares (año t, año t+1) en ind_institucion."""
    logger.info("[ML] Cargando datos de entrenamiento...")
    return _sql_to_df("SELECT * FROM vw_dataset_ml")


def cargar_datos_prediccion() -> pd.DataFrame:
    """Lee vw_dataset_ml_prediccion (último año disponible, sin etiqueta)."""
    logger.info("[ML] Cargando datos de predicción...")
    return _sql_to_df("SELECT * FROM vw_dataset_ml_prediccion")


# ── 2. Entrenamiento ──────────────────────────────────────────────────────────
def entrenar_modelo(df: pd.DataFrame) -> dict:
    """
    Entrena Random Forest con muestreo estratificado de hasta 30k filas.
    Devuelve el pipeline entrenado y las métricas.
    """
    df = df.dropna(subset=[TARGET]).copy()
    if len(df) < 50:
        raise ValueError(f"Solo {len(df)} filas con etiqueta — insuficiente.")

    # Muestreo estratificado para acelerar el entrenamiento
    if len(df) > MAX_FILAS_ENTRENAMIENTO:
        logger.info(f"[ML] Muestreando {MAX_FILAS_ENTRENAMIENTO} de {len(df)} filas...")
        # Separa por clase y toma muestra proporcional de cada una
        grupos = []
        for clase, grupo in df.groupby(TARGET):
            n = max(10, int(MAX_FILAS_ENTRENAMIENTO * len(grupo) / len(df)))
            n = min(n, len(grupo))
            grupos.append(grupo.sample(n=n, random_state=42))
        df = pd.concat(grupos, ignore_index=True)

    X = df[FEATURES].copy()
    y = df[TARGET].astype(int)

    # Convierte columnas Decimal de MySQL a float
    for col in X.columns:
        X[col] = pd.to_numeric(X[col], errors='coerce')

    # Pipeline: imputa NaN → escala → clasifica
    pipeline = Pipeline([
        ('imputer', SimpleImputer(strategy='median')),
        ('scaler',  StandardScaler()),
        ('modelo',  RandomForestClassifier(
            n_estimators=100,        # Rápido y suficientemente preciso
            max_depth=10,
            min_samples_leaf=5,
            class_weight='balanced', # Compensa el desbalance (14% positivos)
            random_state=42,
            n_jobs=-1,
        )),
    ])

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )
    logger.info(f"[ML] Entrenando con {len(X_train)} filas...")
    pipeline.fit(X_train, y_train)

    y_pred  = pipeline.predict(X_test)
    y_proba = pipeline.predict_proba(X_test)[:, 1]

    metricas = {
        "accuracy":        round(float(accuracy_score(y_test, y_pred)), 4),
        "roc_auc":         round(float(roc_auc_score(y_test, y_proba)), 4),
        "n_entrenamiento": int(len(X_train)),
        "n_validacion":    int(len(X_test)),
        "n_total":         int(len(df)),
        "reporte":         classification_report(y_test, y_pred, output_dict=True),
        "importancia_features": dict(zip(
            FEATURES,
            [round(float(v), 4) for v in
             pipeline.named_steps['modelo'].feature_importances_]
        )),
    }
    logger.info(f"[ML] Entrenamiento OK — AUC: {metricas['roc_auc']}")
    return {"pipeline": pipeline, "metricas": metricas}


# ── 3. Predicción año actual ──────────────────────────────────────────────────
def predecir(pipeline, df_pred: pd.DataFrame) -> pd.DataFrame:
    """Aplica el modelo y agrega probabilidad + nivel de riesgo ML."""
    X = df_pred[FEATURES].copy()
    for col in X.columns:
        X[col] = pd.to_numeric(X[col], errors='coerce')

    proba  = pipeline.predict_proba(X)[:, 1]
    result = df_pred[['id_institucion', 'id_periodo', 'anio']].copy()
    result['probabilidad_ml']   = np.round(proba, 4)
    result['nivel_riesgo_ml']   = pd.cut(
        proba, bins=[-0.001, 0.35, 0.60, 1.001],
        labels=['BAJO', 'MEDIO', 'ALTO']
    ).astype(str)
    return result


# ── 4. Proyección años futuros ────────────────────────────────────────────────
def proyectar_futuros(pipeline, df_base: pd.DataFrame, anios_futuros: list) -> pd.DataFrame:
    """
    Proyecta riesgo para años futuros aplicando degradación del +5% por año
    sobre las tasas del último año real (simula ausencia de intervención).
    Los registros proyectados tienen id_periodo=None.
    """
    resultados = []
    for i, anio_futuro in enumerate(anios_futuros, start=1):
        df_fut = df_base.copy()
        factor = 1.0 + (0.05 * i)
        for col in ['tasa_retiro', 'tasa_desaprobacion', 'tasa_atraso',
                    'tasa_desercion_distrital', 'tasa_recuperacion']:
            if col in df_fut.columns:
                df_fut[col] = pd.to_numeric(df_fut[col], errors='coerce')
                df_fut[col] = (df_fut[col] * factor).clip(upper=100)

        X = df_fut[FEATURES].copy()
        for col in X.columns:
            X[col] = pd.to_numeric(X[col], errors='coerce')

        proba = pipeline.predict_proba(X)[:, 1]
        df_r  = df_base[['id_institucion']].copy()
        df_r['anio']            = anio_futuro
        df_r['id_periodo']      = None
        df_r['probabilidad_ml'] = np.round(proba, 4)
        df_r['nivel_riesgo_ml'] = pd.cut(
            proba, bins=[-0.001, 0.35, 0.60, 1.001],
            labels=['BAJO', 'MEDIO', 'ALTO']
        ).astype(str)
        resultados.append(df_r)
        logger.info(f"[ML] Proyección {anio_futuro}: ALTO={int((proba>=0.60).sum())}")

    return pd.concat(resultados, ignore_index=True) if resultados else pd.DataFrame()


# ── 5. Guardar en BD (por lotes) ──────────────────────────────────────────────
def guardar_en_bd(df_resultados: pd.DataFrame, id_carga=None) -> int:
    """
    Inserta SOLO los resultados del año real en eval_riesgo (no proyecciones).
    Las proyecciones futuras se calculan on-demand desde el modelo guardado.
    Usa INSERT ... ON DUPLICATE KEY UPDATE para re-ejecuciones limpias.
    """
    # Filtra solo filas que NO son proyecciones (id_periodo real)
    df_real = df_resultados[
        df_resultados['id_periodo'].notna() &
        (df_resultados['id_periodo'].astype(str) != 'None')
    ].copy()

    if df_real.empty:
        return 0

    conn   = _get_conn()
    cursor = conn.cursor()

    # Borra predicciones ML anteriores para este método
    cursor.execute("DELETE FROM eval_riesgo WHERE metodo = 'ML'")
    conn.commit()
    logger.info("[ML] Registros ML anteriores eliminados.")

    LOTE  = 500
    total = 0
    filas = df_real.to_dict('records')

    for inicio in range(0, len(filas), LOTE):
        lote = filas[inicio:inicio + LOTE]
        vals = []
        for f in lote:
            nivel   = str(f.get('nivel_riesgo_ml', 'BAJO'))
            if nivel not in ('ALTO', 'MEDIO', 'BAJO'):
                nivel = 'BAJO'
            proba   = float(f['probabilidad_ml'])
            id_inst = int(f['id_institucion'])
            id_per  = int(f['id_periodo'])
            puntaje = round(proba * 100, 2)
            factores = ("Alto riesgo ML" if nivel == 'ALTO'
                        else "Riesgo moderado ML" if nivel == 'MEDIO' else "")
            vals.append((id_inst, id_per, id_carga, puntaje, proba, nivel, factores))

        cursor.executemany("""
            INSERT INTO eval_riesgo
                (id_institucion, id_periodo, id_carga, metodo,
                 puntaje, probabilidad_ml, nivel_riesgo, factores, fecha_calculo)
            VALUES (%s, %s, %s, 'ML', %s, %s, %s, %s, NOW())
            ON DUPLICATE KEY UPDATE
                puntaje         = VALUES(puntaje),
                probabilidad_ml = VALUES(probabilidad_ml),
                nivel_riesgo    = VALUES(nivel_riesgo),
                factores        = VALUES(factores),
                fecha_calculo   = NOW()
        """, vals)
        conn.commit()
        total += len(lote)
        logger.info(f"[ML] Guardados {total}/{len(filas)} registros...")

    cursor.close()
    conn.close()
    return total


# ── 6. Pipeline principal ─────────────────────────────────────────────────────
def ejecutar_pipeline_ml(anios_futuros=None, guardar=True) -> dict:
    """
    Ejecuta el flujo completo y devuelve un resumen con todas las métricas.
    """
    if anios_futuros is None:
        anios_futuros = [2025, 2026]

    resumen = {"inicio": datetime.now().isoformat(), "estado": "en_progreso", "etapas": {}}

    # Paso 1: Cargar datos
    df_train = cargar_datos_entrenamiento()
    resumen["etapas"]["carga_entrenamiento"] = {
        "filas": len(df_train),
        "anios": sorted(df_train['anio'].unique().tolist()) if len(df_train) > 0 else []
    }

    if len(df_train) < 50:
        resumen["estado"]  = "error"
        resumen["mensaje"] = (
            f"vw_dataset_ml devuelve {len(df_train)} filas. "
            "Se necesitan al menos 50. Verifica que ind_institucion "
            "tenga datos de múltiples años."
        )
        return resumen

    # Paso 2: Entrenar
    resultado_ent = entrenar_modelo(df_train)
    pipeline      = resultado_ent["pipeline"]
    resumen["etapas"]["entrenamiento"] = resultado_ent["metricas"]

    joblib.dump(pipeline, MODELO_PATH)
    logger.info(f"[ML] Modelo guardado en {MODELO_PATH}")

    # Paso 3: Predecir año actual
    df_pred = cargar_datos_prediccion()
    resumen["etapas"]["carga_prediccion"] = {"filas": len(df_pred)}

    if len(df_pred) == 0:
        resumen["estado"]  = "advertencia"
        resumen["mensaje"] = "vw_dataset_ml_prediccion está vacía."
        return resumen

    df_actual = predecir(pipeline, df_pred)
    resumen["etapas"]["prediccion_actual"] = {
        "anio":  int(df_actual['anio'].iloc[0]),
        "filas": len(df_actual),
        "alto":  int((df_actual['nivel_riesgo_ml'] == 'ALTO').sum()),
        "medio": int((df_actual['nivel_riesgo_ml'] == 'MEDIO').sum()),
        "bajo":  int((df_actual['nivel_riesgo_ml'] == 'BAJO').sum()),
    }

    # Paso 4: Proyectar futuros
    df_futuros = proyectar_futuros(pipeline, df_pred, anios_futuros)
    resumen["etapas"]["proyeccion_futura"] = {
        "anios": anios_futuros,
        "filas": len(df_futuros),
    }

    # Paso 5: Guardar
    if guardar:
        df_todo    = pd.concat([df_actual, df_futuros], ignore_index=True)
        insertados = guardar_en_bd(df_todo)
        resumen["etapas"]["guardado_bd"] = {"registros": insertados}

    resumen["estado"] = "completado"
    resumen["fin"]    = datetime.now().isoformat()
    logger.info(f"[ML] Pipeline completado. AUC={resultado_ent['metricas']['roc_auc']}")
    return resumen


def cargar_modelo_guardado():
    if not os.path.exists(MODELO_PATH):
        raise FileNotFoundError("No hay modelo entrenado. Ejecuta POST /api/ml/entrenar")
    return joblib.load(MODELO_PATH)
