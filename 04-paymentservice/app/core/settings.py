import os


class Settings:
    database_url = os.getenv("DATABASE_URL", "sqlite:///./payment.db")
    razorpay_key_id = os.getenv("RAZORPAY_KEY_ID", "")
    razorpay_key_secret = os.getenv("RAZORPAY_KEY_SECRET", "")


settings = Settings()
