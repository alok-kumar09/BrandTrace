
import os

class Config:

    SQLALCHEMY_DATABASE_URI = "sqlite:///brandtrace.db"

    SQLALCHEMY_TRACK_MODIFICATIONS = False

    SECRET_KEY = os.getenv("SECRET_KEY", "brandtrace-dev-key")
