"""
Ejecuta el pipeline ML completo de forma independiente (sin FastAPI).
Entrena el modelo Random Forest con datos 2021-2023,
predice 2024 y proyecta 2025 y 2026.
Guarda todo en eval_riesgo con metodo='ML'.

Uso:
    python ejecutar_ml.py
"""
import sys, os, logging, time

# Configura logging para ver el progreso en consola
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(message)s",
    datefmt="%H:%M:%S"
)

# Agrega el directorio del backend al path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Variables de entorno para la conexión a BD
os.environ.setdefault("DB_HOST",     "localhost")
os.environ.setdefault("DB_USER",     "root")
os.environ.setdefault("DB_PASSWORD", "admin$.")
os.environ.setdefault("DB_NAME",     "BD_EDUCACION")

from app.ml.modelo import ejecutar_pipeline_ml

print("=" * 65)
print(" ALERTA EDUCATIVA — Ejecución del Pipeline ML")
print("=" * 65)
print(" Datos:      vw_dataset_ml (2021-2023) + predicción 2024")
print(" Proyectar:  2025, 2026")
print(" Esto puede tardar entre 1 y 3 minutos...")
print("=" * 65)

t0 = time.time()

resultado = ejecutar_pipeline_ml(
    anios_futuros=[2025, 2026],
    guardar=True
)

elapsed = time.time() - t0

print("\n" + "=" * 65)
print(f" Estado: {resultado['estado'].upper()}")

if resultado['estado'] == 'error':
    print(f" Mensaje: {resultado.get('mensaje')}")
    sys.exit(1)

if resultado['estado'] == 'completado':
    et = resultado['etapas']

    # Datos de entrenamiento
    carga = et.get('carga_entrenamiento', {})
    print(f"\n Datos cargados:  {carga.get('filas', 0):,} filas — años {carga.get('anios')}")

    # Métricas del modelo
    m = et.get('entrenamiento', {})
    print(f"\n Modelo entrenado:")
    print(f"   Filas usadas : {m.get('n_total', 0):,} (muestra estratificada)")
    print(f"   Accuracy     : {m.get('accuracy')}")
    print(f"   ROC-AUC      : {m.get('roc_auc')}")

    # Importancia de features (top 5)
    imp = m.get('importancia_features', {})
    if imp:
        top5 = sorted(imp.items(), key=lambda x: x[1], reverse=True)[:5]
        print(f"\n   Top 5 variables más importantes:")
        for feat, val in top5:
            print(f"     {feat:<30} {val:.4f}")

    # Predicción año actual
    p = et.get('prediccion_actual', {})
    print(f"\n Predicción {p.get('anio', 2024)}:")
    print(f"   Alto  : {p.get('alto', 0):,} instituciones")
    print(f"   Medio : {p.get('medio', 0):,} instituciones")
    print(f"   Bajo  : {p.get('bajo', 0):,} instituciones")

    # Proyecciones futuras
    pf = et.get('proyeccion_futura', {})
    print(f"\n Proyecciones futuras: {pf.get('anios')} — {pf.get('filas', 0):,} registros")

    # Guardado
    g = et.get('guardado_bd', {})
    print(f"\n Registros guardados en eval_riesgo: {g.get('registros', 0):,}")

print(f"\n Tiempo total: {elapsed:.1f} segundos")
print("=" * 65)
print(" Listo. Ahora la pantalla 'Predicción ML' mostrará los gráficos.")
print("=" * 65)
