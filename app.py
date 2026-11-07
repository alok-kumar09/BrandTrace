
from flask import Flask, jsonify

app = Flask(__name__)


@app.route("/")
def home():
    return """
    <h1>Welcome to BrandTrace</h1>
    <p>Your AI-powered Brand Governance Platform.</p>
    """


@app.route("/health")
def health():
    return jsonify({
        "status": "running",
        "project": "BrandTrace"
    })


if __name__ == "__main__":
    app.run(debug=True)
