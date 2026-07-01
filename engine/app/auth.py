"""Vérification du JWT émis par le Core (refus par défaut)."""

import jwt
from fastapi import Header, HTTPException, status

from . import config


def verify_token(authorization: str = Header(default="")) -> dict:
    """Dépendance FastAPI : valide `Authorization: Bearer <jwt>` (HS256, secret du Core).

    Refuse par défaut (401). Désactivable en local via ENGINE_REQUIRE_AUTH=false.
    """
    if not config.REQUIRE_AUTH:
        return {"sub": 0, "username": "dev", "role": "dev"}

    if not authorization.startswith("Bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token manquant")
    token = authorization[len("Bearer ") :]
    try:
        # verify_sub=False : le Core (NestJS) émet `sub` numérique (user.id),
        # alors que PyJWT >=2.10 impose un `sub` string. On désactive cette vérif
        # pour rester interopérable avec le token du Core.
        return jwt.decode(
            token,
            config.JWT_SECRET,
            algorithms=[config.JWT_ALGORITHM],
            options={"verify_sub": False},
        )
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token invalide ou expiré")
