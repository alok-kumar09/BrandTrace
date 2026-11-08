import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
# Use /tmp on Render if no persistent disk or external DB is configured
INSTANCE_DIR = Path("/tmp/instance") if os.getenv("RENDER") else BASE_DIR / "instance"
DATABASE_PATH = INSTANCE_DIR / "brandtrace.db"

INSTANCE_DIR.mkdir(parents=True, exist_ok=True)

class Config:
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL", f"sqlite:///{DATABASE_PATH.as_posix()}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SECRET_KEY = os.getenv("SECRET_KEY", "brandtrace-dev-key")
    JWT_SECRET_KEY = os.getenv(
        "JWT_SECRET_KEY", "brandtrace-jwt-dev-key-change-before-deployment"
    )
    JWT_ACCESS_TOKEN_EXPIRES = 60 * 60 * 24