
from flask import Flask
from flask_cors import CORS
from config import Config
from database import db
from routes.review import review_bp
from routes.guidelines import guidelines_bp
from routes.organisations import organisations_bp
from routes.history import history_bp
from routes.approvals import approvals_bp
from flask_jwt_extended import JWTManager
import os
from routes.auth import auth_bp
from flask_migrate import Migrate

app = Flask(__name__)

# Load application configuration
app.config.from_object(Config)
app.config["JWT_SECRET_KEY"] = os.getenv(
    "JWT_SECRET_KEY",
    "brandtrace-jwt-dev-key-change-before-deployment"
)

jwt = JWTManager(app)

# Allow frontend communication
CORS(app)

# Initialise database
db.init_app(app)
migrate = Migrate(app, db)
app.register_blueprint(review_bp)
app.register_blueprint(guidelines_bp)
app.register_blueprint(organisations_bp)
app.register_blueprint(history_bp)
app.register_blueprint(approvals_bp)
app.register_blueprint(auth_bp)


@app.route("/")
def home():
    return {
        "message": "BrandTrace Backend Running",
        "database": "SQLite",
        "status": "success"
    }


@app.route("/api/health")
def health():
    return {
        "status": "healthy",
        "application": "BrandTrace"
    }


if __name__ == "__main__":
    app.run(debug=True)
