"""
Inicia el servidor FastAPI con uvicorn.
Ejecuta este archivo para arrancar el backend:
  python iniciar_backend.py
El servidor quedará disponible en: http://localhost:8000
Documentación automática en:      http://localhost:8000/docs
"""
import subprocess, sys, os

os.chdir(os.path.dirname(os.path.abspath(__file__)))

print("Iniciando Alerta Educativa - Backend (FastAPI)")
print("Servidor disponible en: http://localhost:8000")
print("Documentación API en:   http://localhost:8000/docs")
print("Presiona Ctrl+C para detener\n")

subprocess.run([
    sys.executable, "-m", "uvicorn",
    "app.main:app",
    "--host", "0.0.0.0",
    "--port", "8000",
])
