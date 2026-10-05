# Alerta Educativa — SAT de Deserción Escolar

Sistema de Alerta Temprana para identificar instituciones educativas con riesgo de deserción escolar, desarrollado para la UGEL.

## Tecnologías

- **Backend:** Python + FastAPI + MySQL
- **Frontend:** React + Vite + TailwindCSS + Recharts + Leaflet
- **ML:** scikit-learn (Random Forest)

## Requisitos previos

- Python 3.10+
- Node.js 18+
- MySQL con la base de datos `BD_EDUCACION` cargada (ETL ejecutado previamente)

## Instalación

### Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env        # Edita .env con tus credenciales de BD
python iniciar_backend.py   # Servidor en http://localhost:8000
```

### Frontend

```bash
cd frontend/alerta-educativa
npm install
npm run dev                 # Aplicación en http://localhost:5173
```

### Modelo ML (una sola vez)

```bash
cd backend
python ejecutar_ml.py       # Entrena el modelo y guarda predicciones en BD
```

## Estructura del proyecto

```
├── backend/
│   ├── app/
│   │   ├── routers/        # Endpoints de la API REST
│   │   ├── ml/             # Módulo de Machine Learning
│   │   ├── main.py
│   │   ├── database.py
│   │   └── config.py
│   ├── ejecutar_ml.py      # Script para entrenar el modelo ML
│   ├── iniciar_backend.py
│   └── requirements.txt
└── frontend/alerta-educativa/
    └── src/
        ├── pages/          # Pantallas: Dashboard, Instituciones, Mapa, Reportes, ML
        ├── components/     # Componentes reutilizables
        ├── services/       # Cliente HTTP (Axios)
        └── context/        # Estado global (autenticación)
```

## Usuario de prueba

Configura un usuario en la tabla `ctl_usuario` de `BD_EDUCACION`.
