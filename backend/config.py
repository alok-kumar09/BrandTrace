import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

BASE_DIR = Path(__file__).resolve().parent.parent  # Project root
INSTANCE_DIR = Path("/tmp/instance") if os.getenv("RENDER") else BASE_DIR / "instance"
INSTANCE_DIR.mkdir(parents=True, exist_ok=True)

DATABASE_PATH = INSTANCE_DIR / "brandtrace.db"

class Config:
    db_url = os.getenv("DATABASE_URL")
    
    # If DATABASE_URL is set in .env as a relative sqlite path, ignore it 
    # and force the robust absolute path. (Allows external DBs like PostgreSQL if needed)
    if db_url and not db_url.startswith("sqlite:///instance"):
        SQLALCHEMY_DATABASE_URI = db_url
    else:
        # Force absolute path with 4 slashes on Linux/macOS
        abs_path = DATABASE_PATH.resolve().as_posix()
        if os.name != "nt":
            SQLALCHEMY_DATABASE_URI = f"sqlite:////{abs_path.lstrip('/')}"
        else:
            SQLALCHEMY_DATABASE_URI = f"sqlite:///{abs_path}"

    print(f"Using database URI: {SQLALCHEMY_DATABASE_URI}")

    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SECRET_KEY = os.getenv("SECRET_KEY", "brandtrace-dev-key")
    JWT_SECRET_KEY = os.getenv(
        "JWT_SECRET_KEY", "brandtrace-jwt-dev-key-change-before-deployment"
    )
    JWT_ACCESS_TOKEN_EXPIRES = 60 * 60 * 24