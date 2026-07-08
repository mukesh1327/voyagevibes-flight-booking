from fastapi import FastAPI

from app.api.routes import router
from app.db.base import Base
from app.db.session import engine
from app.models import payment  # noqa: F401 - imports models so metadata is registered.
from app.services.razorpay_provider import verify_razorpay_signature


app = FastAPI(title="VoyageVibes Payment Service")
app.include_router(router)


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)


__all__ = ["app", "verify_razorpay_signature"]
