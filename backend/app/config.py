# ============================================================
# config.py - Configuración general del backend
# Lee las variables del archivo .env y las expone al resto
# de la aplicación como constantes importables.
# ============================================================

import os
from dotenv import load_dotenv

# Carga las variables definidas en el archivo .env
load_dotenv()

# --- Conexión a la base de datos MySQL ---
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "admin$.")
DB_NAME = os.getenv("DB_NAME", "BD_EDUCACION")

# --- Configuración de JWT (tokens de autenticación) ---
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "alerta_educativa_secret_key_2024")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "480"))
