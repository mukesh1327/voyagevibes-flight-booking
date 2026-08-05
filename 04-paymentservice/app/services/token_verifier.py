import time

import httpx
import jwt
from jwt.algorithms import RSAAlgorithm

from app.core.settings import settings

_JWKS_CACHE: dict = {"keys": None, "fetched_at": 0.0}
_JWKS_TTL_SECONDS = 300


def _fetch_jwks() -> dict:
    # The realm's certificate is self-signed in this local/demo deployment.
    response = httpx.get(settings.keycloak_jwks_uri, timeout=5.0, verify=False)  # noqa: S501
    response.raise_for_status()
    keys = {key["kid"]: key for key in response.json()["keys"]}
    _JWKS_CACHE["keys"] = keys
    _JWKS_CACHE["fetched_at"] = time.time()
    return keys


def _signing_key_for(kid: str):
    keys = _JWKS_CACHE["keys"]
    stale = time.time() - _JWKS_CACHE["fetched_at"] > _JWKS_TTL_SECONDS
    if keys is None or stale or kid not in keys:
        keys = _fetch_jwks()

    jwk = keys.get(kid)
    if jwk is None:
        raise jwt.InvalidTokenError("Unknown signing key")

    return RSAAlgorithm.from_jwk(jwk)


def decode_and_verify(token: str) -> dict:
    header = jwt.get_unverified_header(token)
    key = _signing_key_for(header["kid"])
    return jwt.decode(
        token,
        key=key,
        algorithms=["RS256"],
        issuer=settings.keycloak_issuer,
        options={"verify_aud": False},
    )


def extract_roles(claims: dict) -> set[str]:
    roles = (claims.get("realm_access") or {}).get("roles") or []
    return {str(role).lower() for role in roles}
