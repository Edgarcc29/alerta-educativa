# ============================================================
# database.py - Manejo de la conexión a MySQL
# Provee una función get_db() que abre y cierra la conexión
# de forma segura. Se usa como dependencia en los endpoints.
# ============================================================

import mysql.connector
from app.config import DB_HOST, DB_USER, DB_PASSWORD, DB_NAME


def get_db():
    """
    Genera una conexión a la base de datos BD_EDUCACION.
    Al terminar la petición, cierra la conexión automáticamente
    gracias al bloque try/finally.
    Se usa con 'yield' para que FastAPI la inyecte en cada endpoint.
    """
    conn = mysql.connector.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        # Devuelve los resultados como diccionarios (clave: nombre de columna)
        use_pure=True
    )
    try:
        yield conn
    finally:
        conn.close()


def query_one(conn, sql: str, params: tuple = ()):
    """
    Ejecuta una consulta SQL y devuelve una sola fila como diccionario.
    Útil para consultas de detalle o verificaciones.
    """
    cursor = conn.cursor(dictionary=True)
    cursor.execute(sql, params)
    row = cursor.fetchone()
    cursor.close()
    return row


def query_all(conn, sql: str, params: tuple = ()):
    """
    Ejecuta una consulta SQL y devuelve todas las filas como lista de diccionarios.
    Útil para listados, filtros y tablas.
    """
    cursor = conn.cursor(dictionary=True)
    cursor.execute(sql, params)
    rows = cursor.fetchall()
    cursor.close()
    return rows
