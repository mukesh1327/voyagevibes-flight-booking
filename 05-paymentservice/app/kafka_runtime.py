import json
import logging
import os
import threading
import time
from typing import Dict, List, Optional


def _parse_bool(value: Optional[str], default: bool) -> bool:
    if value is None or value == "":
        return default
    return value.strip().lower() == "true"


def _parse_list(value: Optional[str], fallback: str) -> List[str]:
    source = value if value else fallback
    return [item.strip() for item in str(source).split(",") if item.strip()]


class PaymentKafkaMetrics:
    def __init__(self):
        self._lock = threading.Lock()
        self._published_payment_events = 0
        self._failed_payment_publishes = 0
        self._consumed_booking_events = 0
        self._failed_booking_events = 0

    def increment_published(self):
        with self._lock:
            self._published_payment_events += 1

    def increment_failed_publish(self):
        with self._lock:
            self._failed_payment_publishes += 1

    def increment_consumed_booking(self):
        with self._lock:
            self._consumed_booking_events += 1

    def increment_failed_booking(self):
        with self._lock:
            self._failed_booking_events += 1

    def snapshot(self) -> Dict[str, int]:
        with self._lock:
            return {
                "publishedPaymentEvents": self._published_payment_events,
                "failedPaymentPublishes": self._failed_payment_publishes,
                "consumedBookingEvents": self._consumed_booking_events,
                "failedBookingEvents": self._failed_booking_events,
            }


class PaymentKafkaRuntime:
    def __init__(self, service, logger: Optional[logging.Logger] = None):
        self.service = service
        self.logger = logger or logging.getLogger("payment.kafka")
        self.metrics = PaymentKafkaMetrics()

        self.enabled = _parse_bool(os.getenv("KAFKA_ENABLED"), False)
        self.required = _parse_bool(os.getenv("KAFKA_REQUIRED"), False)
        self.client_id = os.getenv("KAFKA_CLIENT_ID", "payment-service")
        self.brokers = _parse_list(os.getenv("KAFKA_BOOTSTRAP_SERVERS"), "localhost:9092")
        self.consumer_group_id = os.getenv("KAFKA_CONSUMER_GROUP_ID", "payment-service")
        self.auto_offset_reset = os.getenv("KAFKA_AUTO_OFFSET_RESET", "latest").strip().lower()
        self.payment_events_topic = os.getenv("KAFKA_PAYMENT_EVENTS_TOPIC", "payment.events").strip()
        self.booking_events_topic = os.getenv("KAFKA_BOOKING_EVENTS_TOPIC", "booking.events").strip()
        self.ensure_topics = _parse_bool(os.getenv("KAFKA_ENSURE_TOPICS"), False)
        self.topic_partitions = max(1, int(os.getenv("KAFKA_TOPIC_PARTITIONS", "1")))
        self.topic_replication_factor = max(1, int(os.getenv("KAFKA_TOPIC_REPLICATION_FACTOR", "1")))

        self._producer = None
        self._consumer = None
        self._thread = None
        self._stop_event = threading.Event()
        self._started = False

    def start(self):
        if not self.enabled:
            self.logger.info("payment-service kafka runtime disabled")
            return

        try:
            from kafka import KafkaConsumer, KafkaProducer  # type: ignore

            if self.ensure_topics:
                self._ensure_topics()

            self._producer = KafkaProducer(
                bootstrap_servers=self.brokers,
                client_id=self.client_id,
                value_serializer=lambda value: json.dumps(value).encode("utf-8"),
                key_serializer=lambda key: str(key).encode("utf-8"),
                acks=1,
            )

            self._consumer = KafkaConsumer(
                self.booking_events_topic,
                bootstrap_servers=self.brokers,
                group_id=self.consumer_group_id,
                client_id=f"{self.client_id}-consumer",
                auto_offset_reset="earliest" if self.auto_offset_reset == "earliest" else "latest",
                enable_auto_commit=False,
                value_deserializer=lambda value: json.loads(value.decode("utf-8")),
                consumer_timeout_ms=1000,
            )

            self._stop_event.clear()
            self._thread = threading.Thread(target=self._consume_loop, daemon=True)
            self._thread.start()
            self._started = True
            self.logger.info(
                "payment-service kafka started (consume: %s, produce: %s)",
                self.booking_events_topic,
                self.payment_events_topic,
            )
        except Exception as ex:
            self.logger.error("payment-service kafka startup failed: %s", ex)
            self.stop()
            if self.required:
                raise RuntimeError("kafka startup failed and KAFKA_REQUIRED=true") from ex

    def stop(self):
        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=3)

        if self._consumer is not None:
            try:
                self._consumer.close()
            except Exception:
                pass
            finally:
                self._consumer = None

        if self._producer is not None:
            try:
                self._producer.flush(timeout=2)
                self._producer.close()
            except Exception:
                pass
            finally:
                self._producer = None

        self._started = False

    def publish_payment_event(self, event: Dict, key: str):
        if not self.enabled or self._producer is None:
            return

        try:
            future = self._producer.send(self.payment_events_topic, key=key, value=event)
            future.get(timeout=5)
            self.metrics.increment_published()
        except Exception as ex:
            self.metrics.increment_failed_publish()
            self.logger.error("failed publishing payment event: %s", ex)

    def _consume_loop(self):
        while not self._stop_event.is_set():
            if self._consumer is None:
                break

            try:
                for record in self._consumer:
                    if self._stop_event.is_set():
                        break

                    payload = record.value
                    self.metrics.increment_consumed_booking()
                    try:
                        self.service.apply_booking_event(payload)
                        try:
                            self._consumer.commit()
                        except Exception as commit_ex:
                            self.logger.warning("kafka offset commit failed in payment-service: %s", commit_ex)
                    except Exception as ex:
                        self.metrics.increment_failed_booking()
                        self.logger.error("failed processing booking event payload: %s", ex)
                        time.sleep(1)
            except Exception as ex:
                self.logger.warning("kafka consume loop error in payment-service: %s", ex)
                time.sleep(1)

    def _ensure_topics(self):
        try:
            from kafka.admin import KafkaAdminClient, NewTopic  # type: ignore
            from kafka.errors import TopicAlreadyExistsError  # type: ignore
        except Exception as ex:
            self.logger.warning("kafka admin client unavailable; skipping topic ensure: %s", ex)
            return

        admin = None
        try:
            admin = KafkaAdminClient(
                bootstrap_servers=self.brokers,
                client_id=f"{self.client_id}-admin",
            )
            topics = [
                NewTopic(
                    name=self.payment_events_topic,
                    num_partitions=self.topic_partitions,
                    replication_factor=self.topic_replication_factor,
                ),
                NewTopic(
                    name=self.booking_events_topic,
                    num_partitions=self.topic_partitions,
                    replication_factor=self.topic_replication_factor,
                ),
            ]
            admin.create_topics(new_topics=topics, validate_only=False)
            self.logger.info(
                "ensured kafka topics for payment-service: %s, %s",
                self.payment_events_topic,
                self.booking_events_topic,
            )
        except TopicAlreadyExistsError:
            self.logger.info("kafka topics already exist for payment-service")
        except Exception as ex:
            self.logger.warning("topic ensure step failed for payment-service: %s", ex)
        finally:
            if admin is not None:
                try:
                    admin.close()
                except Exception:
                    pass
