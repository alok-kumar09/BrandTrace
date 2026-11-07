from flask import Flask, jsonify
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

jwt = JWTManager(app)

# Allow frontend communication (any origin in dev, incl. file:// and :5500)
CORS(app, resources={r"/api/*": {"origins": "*"}},
     allow_headers=["Content-Type", "Authorization"])


# ---- Consistent JSON auth errors -------------------------------------
# flask-jwt-extended answers 422 for a malformed token (e.g. a leftover
# "mock-jwt-token-for-demo-mode"). Map everything to 401 so the frontend
# has ONE rule: 401 = sign in again.
@jwt.unauthorized_loader
def _missing_token(reason):
    return jsonify({"error": "Authentication required", "detail": reason}), 401


@jwt.invalid_token_loader
def _invalid_token(reason):
    return jsonify({"error": "Invalid session token. Please sign in again.",
                    "detail": reason}), 401


@jwt.expired_token_loader
def _expired_token(header, payload):
    return jsonify({"error": "Session expired. Please sign in again."}), 401


@app.errorhandler(404)
def _not_found(e):
    return jsonify({"error": "Not found"}), 404


@app.errorhandler(405)
def _bad_method(e):
    return jsonify({"error": "Method not allowed"}), 405

# Initialise database
db.init_app(app)
migrate = Migrate(app, db)

with app.app_context():
    from services.bootstrap import bootstrap
    bootstrap()

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
