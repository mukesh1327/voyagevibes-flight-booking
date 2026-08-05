import os


class Settings:
    database_url = os.getenv("DATABASE_URL", "sqlite:///./payment.db")
    razorpay_key_id = os.getenv("RAZORPAY_KEY_ID", "")
    razorpay_key_secret = os.getenv("RAZORPAY_KEY_SECRET", "")
    booking_service_url = os.getenv("BOOKING_SERVICE_URL", "http://localhost:8084").rstrip("/")
    keycloak_issuer = os.getenv("KEYCLOAK_ISSUER", "https://keycloak.voyagevibes.in:8091/realms/flight-booking")
    keycloak_jwks_uri = os.getenv(
        "KEYCLOAK_JWKS_URI",
        "https://keycloak:8091/realms/flight-booking/protocol/openid-connect/certs",
    )
    keycloak_token_url = os.getenv(
        "KEYCLOAK_TOKEN_URL",
        "https://keycloak:8091/realms/flight-booking/protocol/openid-connect/token",
    )
    keycloak_service_client_id = os.getenv("KEYCLOAK_SERVICE_CLIENT_ID", "flight-auth-admin")
    keycloak_service_client_secret = os.getenv("KEYCLOAK_SERVICE_CLIENT_SECRET", "CorpWebSecret123$")


settings = Settings()
