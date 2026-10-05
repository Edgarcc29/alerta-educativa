# ============================================================
# routers/auth.py - Endpoints de autenticación
# POST /api/auth/login  → valida credenciales y devuelve token JWT
# POST /api/auth/logout → cierre de sesión (el frontend descarta el token)
# GET  /api/auth/me     → devuelve los datos del usuario autenticado
# ============================================================

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel

from app.database import get_db, query_one
from app.utils.auth import verificar_password, crear_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["Autenticación"])


# --- Modelos de respuesta ---

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    nombre: str
    rol: str
    id_usuario: int


# --- Endpoints ---

@router.post("/login", response_model=TokenResponse, summary="Iniciar sesión")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    conn=Depends(get_db)
):
    """
    Recibe usuario y contraseña.
    Verifica contra ctl_usuario en la base de datos.
    Si es correcto, devuelve un token JWT para usar en las demás peticiones.
    """
    # Busca el usuario activo en la base de datos
    usuario_db = query_one(
        conn,
        "SELECT id_usuario, usuario, password_hash, nombre, rol, activo "
        "FROM ctl_usuario WHERE usuario = %s AND activo = 1",
        (form_data.username,)
    )

    # Si no existe o la contraseña no coincide, rechaza el acceso
    if not usuario_db or not verificar_password(form_data.password, usuario_db["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
        )

    # Actualiza la fecha del último acceso
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE ctl_usuario SET ultimo_acceso = NOW() WHERE id_usuario = %s",
        (usuario_db["id_usuario"],)
    )
    conn.commit()
    cursor.close()

    # Crea el token JWT con los datos del usuario
    token = crear_token({
        "sub": usuario_db["usuario"],
        "id": usuario_db["id_usuario"],
        "nombre": usuario_db["nombre"],
        "rol": usuario_db["rol"],
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "nombre": usuario_db["nombre"],
        "rol": usuario_db["rol"],
        "id_usuario": usuario_db["id_usuario"],
    }


@router.get("/me", summary="Datos del usuario autenticado")
def get_me(current_user: dict = Depends(get_current_user)):
    """
    Devuelve los datos básicos del usuario que está autenticado.
    Útil para que el frontend muestre el nombre y rol en la barra de navegación.
    """
    return {
        "usuario": current_user.get("sub"),
        "nombre": current_user.get("nombre"),
        "rol": current_user.get("rol"),
        "id_usuario": current_user.get("id"),
    }


@router.post("/logout", summary="Cerrar sesión")
def logout(current_user: dict = Depends(get_current_user)):
    """
    Cierre de sesión. Como JWT es sin estado, el logout real
    ocurre cuando el frontend elimina el token almacenado.
    Este endpoint confirma la acción al usuario.
    """
    return {"message": f"Sesión cerrada para {current_user.get('nombre')}"}
