# Cómo ejecutar Alerta Educativa

## Requisitos
- Python 3.x instalado
- Node.js instalado en D:\Node\
- MySQL corriendo con BD_EDUCACION cargada

---

## 1. Iniciar el Backend (FastAPI)

Abre una terminal y ejecuta:

```
cd backend
python iniciar_backend.py
```

El backend queda disponible en:
- API:           http://localhost:8000
- Documentación: http://localhost:8000/docs

---

## 2. Iniciar el Frontend (React)

Abre OTRA terminal y ejecuta:

```
cd frontend\alerta-educativa
D:\Node\npm.cmd run dev
```

La plataforma queda disponible en:
- http://localhost:5173

---

## Nota sobre npm en PowerShell

Si npm da error de "ejecución de scripts deshabilitada", usa siempre:
  D:\Node\npm.cmd  (en lugar de solo: npm)

O ejecuta primero:
  Set-ExecutionPolicy RemoteSigned -Scope CurrentUser

---

## Usuario de prueba

Revisa la tabla ctl_usuario en BD_EDUCACION para ver los usuarios disponibles.
