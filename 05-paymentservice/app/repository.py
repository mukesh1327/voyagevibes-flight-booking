import os
from datetime import datetime, timezone
from typing import Dict, Mapping, Optional
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from psycopg import errors, sql
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool
from psycopg_pool.errors import PoolTimeout


class InMemoryPaymentRepository:
    storage_name = "in-memory"

    def __init__(self):
        self._payments: Dict[str, dict] = {}
        self._payment_by_booking: Dict[str, str] = {}

    def save(self, payment: dict) -> dict:
        self._payments[payment["paymentId"]] = payment
        self._payment_by_booking[payment["bookingId"]] = payment["paymentId"]
        return payment

    def find(self, payment_id: str) -> Optional[dict]:
        return self._payments.get(payment_id)

    def find_by_booking_id(self, booking_id: str) -> Optional[dict]:
        payment_id = self._payment_by_booking.get(booking_id)
        if payment_id is None:
            return None
        return self.find(payment_id)


class PostgresPaymentRepository:
    storage_name = "postgres"

    def __init__(self, dsn: str, schema: str = "public", min_pool_size: int = 1, max_pool_size: int = 10):
        if not dsn or not dsn.strip():
            raise ValueError("postgres dsn is required")

        self.schema = schema.strip() or "public"
        normalized_dsn = _with_connect_timeout(dsn.strip(), seconds=5)
        self.pool = ConnectionPool(
            conninfo=normalized_dsn,
            min_size=max(1, min_pool_size),
            max_size=max(1, max_pool_size),
            kwargs={"autocommit": True},
            open=True,
        )
        try:
            self.pool.wait()
        except PoolTimeout as ex:
            host = _extract_host(normalized_dsn)
            raise RuntimeError(
                "Unable to initialize Postgres pool for payment-service. "
                f"Host='{host}'. Verify DB reachability and credentials. "
                "If running service locally, use host 'localhost'. "
                "If running in docker compose, use host 'paymentservice_postgres'. "
                "If password contains special characters (for example @ or $), URL-encode it in DSN."
            ) from ex
        self._ensure_schema()

    def _ensure_schema(self):
        try:
            with self.pool.connection() as connection:
                with connection.cursor() as cursor:
                    cursor.execute(sql.SQL("CREATE SCHEMA IF NOT EXISTS {}").format(sql.Identifier(self.schema)))
                    cursor.execute(
                        sql.SQL(
                            """
                            CREATE TABLE IF NOT EXISTS {}.payments (
                                payment_id TEXT PRIMARY KEY,
                                booking_id TEXT UNIQUE NOT NULL,
                                amount DOUBLE PRECISION NOT NULL,
                                currency VARCHAR(10) NOT NULL,
                                status VARCHAR(32) NOT NULL,
                                actor_type VARCHAR(20) NOT NULL,
                                user_id TEXT NOT NULL,
                                provider VARCHAR(32) NOT NULL,
                                provider_status VARCHAR(32) NOT NULL,
                                provider_order_id TEXT,
                                provider_payment_id TEXT,
                                provider_refund_id TEXT,
                                provider_payload JSONB,
                                reason TEXT,
                                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                            )
                            """
                        ).format(sql.Identifier(self.schema))
                    )
            return
        except errors.InsufficientPrivilege:
            # If runtime user cannot execute DDL, proceed only when schema/table already exist.
            pass

        with self.pool.connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT 1
                    FROM information_schema.tables
                    WHERE table_schema = %s
                      AND table_name = 'payments'
                    LIMIT 1
                    """,
                    (self.schema,),
                )
                exists = cursor.fetchone() is not None

        if not exists:
            raise RuntimeError(
                f"payment table is missing or inaccessible in schema '{self.schema}'. "
                "Run db/init-paymentservice.sql and db/init-paymentservice-schema.sql with a superuser, "
                "or grant DDL privileges to the app user."
            )

    def save(self, payment: dict) -> dict:
        updated_at = self._normalize_updated_at(payment.get("updatedAt"))
        provider_payload = payment.get("providerPayload")

        try:
            with self.pool.connection() as connection:
                with connection.cursor(row_factory=dict_row) as cursor:
                    cursor.execute(
                        sql.SQL(
                            """
                            INSERT INTO {}.payments (
                                payment_id,
                                booking_id,
                                amount,
                                currency,
                                status,
                                actor_type,
                                user_id,
                                provider,
                                provider_status,
                                provider_order_id,
                                provider_payment_id,
                                provider_refund_id,
                                provider_payload,
                                reason,
                                updated_at
                            )
                            VALUES (
                                %(payment_id)s,
                                %(booking_id)s,
                                %(amount)s,
                                %(currency)s,
                                %(status)s,
                                %(actor_type)s,
                                %(user_id)s,
                                %(provider)s,
                                %(provider_status)s,
                                %(provider_order_id)s,
                                %(provider_payment_id)s,
                                %(provider_refund_id)s,
                                %(provider_payload)s,
                                %(reason)s,
                                %(updated_at)s
                            )
                            ON CONFLICT (payment_id)
                            DO UPDATE SET
                                booking_id = EXCLUDED.booking_id,
                                amount = EXCLUDED.amount,
                                currency = EXCLUDED.currency,
                                status = EXCLUDED.status,
                                actor_type = EXCLUDED.actor_type,
                                user_id = EXCLUDED.user_id,
                                provider = EXCLUDED.provider,
                                provider_status = EXCLUDED.provider_status,
                                provider_order_id = EXCLUDED.provider_order_id,
                                provider_payment_id = EXCLUDED.provider_payment_id,
                                provider_refund_id = EXCLUDED.provider_refund_id,
                                provider_payload = EXCLUDED.provider_payload,
                                reason = EXCLUDED.reason,
                                updated_at = EXCLUDED.updated_at
                            RETURNING
                                payment_id,
                                booking_id,
                                amount,
                                currency,
                                status,
                                actor_type,
                                user_id,
                                provider,
                                provider_status,
                                provider_order_id,
                                provider_payment_id,
                                provider_refund_id,
                                provider_payload,
                                reason,
                                updated_at
                            """
                        ).format(sql.Identifier(self.schema)),
                        {
                            "payment_id": payment["paymentId"],
                            "booking_id": payment["bookingId"],
                            "amount": float(payment["amount"]),
                            "currency": payment["currency"],
                            "status": payment["status"],
                            "actor_type": payment["actorType"],
                            "user_id": payment["userId"],
                            "provider": payment.get("provider") or "mock",
                            "provider_status": payment.get("providerStatus") or "PENDING",
                            "provider_order_id": payment.get("providerOrderId"),
                            "provider_payment_id": payment.get("providerPaymentId"),
                            "provider_refund_id": payment.get("providerRefundId"),
                            "provider_payload": Jsonb(provider_payload) if provider_payload is not None else None,
                            "reason": payment.get("reason"),
                            "updated_at": updated_at,
                        },
                    )
                    row = cursor.fetchone()
                    return self._to_payment(row) if row else payment
        except errors.UniqueViolation as ex:
            raise ValueError(f"payment already exists for booking: {payment['bookingId']}") from ex

    def find(self, payment_id: str) -> Optional[dict]:
        with self.pool.connection() as connection:
            with connection.cursor(row_factory=dict_row) as cursor:
                cursor.execute(
                    sql.SQL(
                        """
                        SELECT
                            payment_id,
                            booking_id,
                            amount,
                            currency,
                            status,
                            actor_type,
                            user_id,
                            provider,
                            provider_status,
                            provider_order_id,
                            provider_payment_id,
                            provider_refund_id,
                            provider_payload,
                            reason,
                            updated_at
                        FROM {}.payments
                        WHERE payment_id = %s
                        """
                    ).format(sql.Identifier(self.schema)),
                    (payment_id,),
                )
                row = cursor.fetchone()
                return self._to_payment(row) if row else None

    def find_by_booking_id(self, booking_id: str) -> Optional[dict]:
        with self.pool.connection() as connection:
            with connection.cursor(row_factory=dict_row) as cursor:
                cursor.execute(
                    sql.SQL(
                        """
                        SELECT
                            payment_id,
                            booking_id,
                            amount,
                            currency,
                            status,
                            actor_type,
                            user_id,
                            provider,
                            provider_status,
                            provider_order_id,
                            provider_payment_id,
                            provider_refund_id,
                            provider_payload,
                            reason,
                            updated_at
                        FROM {}.payments
                        WHERE booking_id = %s
                        """
                    ).format(sql.Identifier(self.schema)),
                    (booking_id,),
                )
                row = cursor.fetchone()
                return self._to_payment(row) if row else None

    def close(self):
        self.pool.close()

    @staticmethod
    def _normalize_updated_at(value) -> datetime:
        if isinstance(value, datetime):
            if value.tzinfo is None:
                return value.replace(tzinfo=timezone.utc)
            return value.astimezone(timezone.utc)

        if isinstance(value, str) and value.strip():
            try:
                parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
                if parsed.tzinfo is None:
                    return parsed.replace(tzinfo=timezone.utc)
                return parsed.astimezone(timezone.utc)
            except ValueError:
                pass

        return datetime.now(timezone.utc)

    @staticmethod
    def _to_payment(row: Mapping) -> dict:
        updated_at = row["updated_at"]
        if isinstance(updated_at, datetime):
            if updated_at.tzinfo is None:
                updated_at = updated_at.replace(tzinfo=timezone.utc)
            updated_at_iso = updated_at.astimezone(timezone.utc).isoformat()
        else:
            updated_at_iso = str(updated_at)

        return {
            "paymentId": row["payment_id"],
            "bookingId": row["booking_id"],
            "amount": float(row["amount"]),
            "currency": row["currency"],
            "status": row["status"],
            "actorType": row["actor_type"],
            "userId": row["user_id"],
            "provider": row["provider"],
            "providerStatus": row["provider_status"],
            "providerOrderId": row["provider_order_id"],
            "providerPaymentId": row["provider_payment_id"],
            "providerRefundId": row["provider_refund_id"],
            "providerPayload": row["provider_payload"],
            "reason": row["reason"],
            "updatedAt": updated_at_iso,
        }


def create_repository_from_env(env: Optional[Mapping[str, str]] = None):
    source = os.environ if env is None else env
    backend = str(source.get("PAYMENT_STORAGE_BACKEND", "postgres")).strip().lower() or "postgres"

    if backend in ("in-memory", "memory", "inmemory"):
        return InMemoryPaymentRepository()

    dsn = str(
        source.get(
            "PAYMENT_DB_DSN",
            source.get(
                "DATABASE_URL",
                "postgresql://payment_app_user:PaymentApp%40123%24@localhost:5432/payment_service_db",
            ),
        )
    ).strip()
    if not dsn:
        raise RuntimeError(
            "Postgres backend selected but no DSN configured. Set PAYMENT_DB_DSN or DATABASE_URL."
        )

    schema = str(source.get("PAYMENT_DB_SCHEMA", "payment")).strip() or "payment"

    try:
        min_pool_size = int(str(source.get("PAYMENT_DB_POOL_MIN_SIZE", "1")))
    except Exception:
        min_pool_size = 1

    try:
        max_pool_size = int(str(source.get("PAYMENT_DB_POOL_MAX_SIZE", "10")))
    except Exception:
        max_pool_size = 10

    return PostgresPaymentRepository(
        dsn=dsn,
        schema=schema,
        min_pool_size=min_pool_size,
        max_pool_size=max_pool_size,
    )


def _with_connect_timeout(dsn: str, seconds: int) -> str:
    try:
        parsed = urlparse(dsn)
        if parsed.scheme not in ("postgresql", "postgres"):
            return dsn

        query_pairs = dict(parse_qsl(parsed.query, keep_blank_values=True))
        if "connect_timeout" not in query_pairs:
            query_pairs["connect_timeout"] = str(max(1, int(seconds)))

        updated_query = urlencode(query_pairs)
        return urlunparse(parsed._replace(query=updated_query))
    except Exception:
        return dsn


def _extract_host(dsn: str) -> str:
    try:
        parsed = urlparse(dsn)
        return parsed.hostname or "unknown"
    except Exception:
        return "unknown"
