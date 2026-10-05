# ============================================================
# utils/auth.py - Funciones de autenticación y tokens JWT
# Contiene:
#   - Verificación de contraseñas con bcrypt
#   - Creación y validación de tokens JWT
#   - Dependencia get_current_user para proteger endpoints
# ============================================================

from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import JWT_SECRET_KEY, JWT_ALGORITHM, JWT_EXPIRE_MINUTES

# Esquema OAuth2: FastAPI busca el token en el header "Authorization: Bearer <token>"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# Contexto para hashear y verificar contraseñas con bcrypt
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verificar_password(password_plano: str, password_hash: str) -> bool:
    """
    Compara la contraseña ingresada por el usuario con el hash
    guardado en la base de datos. Devuelve True si coinciden.
    """
    # Soporte temporal: si el hash empieza con '$2' es bcrypt normal
    # Si no, asumimos SHA2 hex de 64 caracteres (desarrollo inicial)
    if len(password_hash) == 64 and not password_hash.startswith("$2"):
        import hashlib
        return hashlib.sha256(password_plano.encode()).hexdigest() == password_hash
    return pwd_context.verify(password_plano, password_hash)


def hashear_password(password: str) -> str:
    """
    Genera el hash bcrypt de una contraseña.
    Se usa al crear o actualizar usuarios.
    """
    return pwd_context.hash(password)


def crear_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Crea un token JWT con los datos del usuario.
    El token expira según JWT_EXPIRE_MINUTES (por defecto 8 horas).
    """
    payload = data.copy()
    # Calcula la fecha y hora de expiración
    expira = datetime.utcnow() + (expires_delta or timedelta(minutes=JWT_EXPIRE_MINUTES))
    payload.update({"exp": expira})
    # Firma el token con la clave secreta
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """
    Dependencia de FastAPI: valida el token JWT en cada petición protegida.
    Si el token es inválido o expiró, lanza un error 401.
    Devuelve los datos del usuario (id, usuario, rol).
    """
    credencial_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido o expirado. Inicia sesión nuevamente.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # Decodifica y verifica el token
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        usuario: str = payload.get("sub")
        if usuario is None:
            raise credencial_error
        return payload  # Retorna todo el payload: sub, rol, nombre, id
    except JWTError:
        raise credencial_error
