from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from backend.config import Config
from backend.routes.review import review_bp
from backend.routes.guidelines import guidelines_bp
from backend.routes.organisations import organisations_bp
from backend.routes.history import history_bp
from backend.routes.approvals import approvals_bp
from backend.routes.auth import auth_bp
from backend.database import db
from flask_jwt_extended import JWTManager
import os
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
    from backend.services.bootstrap import bootstrap
    bootstrap()

app.register_blueprint(review_bp)
app.register_blueprint(guidelines_bp)
app.register_blueprint(organisations_bp)
app.register_blueprint(history_bp)
app.register_blueprint(approvals_bp)
app.register_blueprint(auth_bp)

# ---- Robust Frontend & Static Asset Routing ----
@app.route("/")
def serve_index():
    return send_from_directory(app.static_folder, "index.html")

@app.route("/<path:filename>")
def serve_static(filename):
    # Check if the requested file exists in the frontend folder (e.g. auth.html, js/auth.js, css/style.css)
    file_path = os.path.join(app.static_folder, filename)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return send_from_directory(app.static_folder, filename)
    
    # If it's an API route that wasn't matched, let Flask handle 404 via errorhandler
    return jsonify({"error": "Not found"}), 404

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
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)