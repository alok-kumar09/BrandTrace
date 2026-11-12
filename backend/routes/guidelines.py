import os
import tempfile
import json

from flask import Blueprint, request , jsonify
from backend.database import db
from backend.models import Organisation, BrandGuideline
from backend.services.guideline_pipeline import process_guideline_pdf
from backend.services.access_control import (
    organisation_member_required,
    organisation_admin_required
)

guidelines_bp = Blueprint("guidelines", __name__)


# Retrieve saved guidelines

@guidelines_bp.route(
    "/api/guidelines/<int:organisation_id>",
    methods=["GET"]
)
@organisation_member_required
def get_guidelines(organisation_id):

    organisation = db.session.get(Organisation, organisation_id)

    if organisation is None:
        return jsonify({"error": "Organisation not found"}), 404

    guideline = BrandGuideline.query.filter_by(
        organisation_id=organisation_id
    ).order_by(BrandGuideline.id.desc()).first()

    if guideline is None:
        return jsonify({"error": "No guidelines found"}), 404

    return jsonify({
        "organisation_id": organisation_id,
        "tone": guideline.tone,
        "restricted_words": json.loads(guideline.restricted_words or "[]"),
        "approved_terms": json.loads(guideline.approved_terms or "[]"),
        "approved_facts": json.loads(guideline.approved_facts or "{}")
    }), 200


# Create or update guidelines

@guidelines_bp.route(
    "/api/guidelines/<int:organisation_id>",
    methods=["PUT"]
)
@organisation_admin_required
def save_guidelines(organisation_id):

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Valid JSON is required"}), 400

    tone = data.get("tone")
    restricted_words = data.get("restricted_words", [])
    approved_terms = data.get("approved_terms", [])
    approved_facts = data.get("approved_facts", {})

    if not isinstance(tone, str) or not tone.strip():
        return jsonify({"error": "Tone is required"}), 400

    if not isinstance(restricted_words, list):
        return jsonify({"error": "restricted_words must be a list"}), 400

    if not isinstance(approved_terms, list):
        return jsonify({"error": "approved_terms must be a list"}), 400

    if not isinstance(approved_facts, dict):
        return jsonify({"error": "approved_facts must be an object"}), 400

    if not all(isinstance(word, str) for word in restricted_words):
        return jsonify({"error": "Restricted words must contain text only"}), 400

    if not all(isinstance(term, str) for term in approved_terms):
        return jsonify({"error": "Approved terms must contain text only"}), 400

    if not all(
        isinstance(key, str) and isinstance(value, str)
        for key, value in approved_facts.items()
    ):
        return jsonify({"error": "Approved facts must contain text keys and values"}), 400

    try:
        organisation = db.session.get(Organisation, organisation_id)

        if organisation is None:
            return jsonify({"error": "Organisation not found"}), 404

        guideline = BrandGuideline.query.filter_by(
            organisation_id=organisation_id
        ).order_by(BrandGuideline.id.desc()).first()

        if guideline is None:
            guideline = BrandGuideline(
                organisation_id=organisation_id
            )
            db.session.add(guideline)

        guideline.tone = tone.strip()
        guideline.restricted_words = json.dumps(restricted_words)
        guideline.approved_terms = json.dumps(approved_terms)
        guideline.approved_facts = json.dumps(approved_facts)

        db.session.commit()

        return jsonify({
            "message": "Guidelines saved successfully",
            "organisation_id": organisation_id
        }), 200

    except Exception:
        db.session.rollback()
        return jsonify({"error": "Could not save guidelines"}), 500

# Upload and process PDF brand guidelines

@guidelines_bp.route(
    "/api/guidelines/<int:organisation_id>/upload-pdf",
    methods=["POST"]
)
@organisation_admin_required
def upload_guideline_pdf(organisation_id):

    uploaded_file = request.files.get("file")

    if uploaded_file is None or not uploaded_file.filename:
        return jsonify({"error": "Please upload a PDF file"}), 400

    if not uploaded_file.filename.lower().endswith(".pdf"):
        return jsonify({"error": "Only PDF files are allowed"}), 400

    organisation = db.session.get(Organisation, organisation_id)

    if organisation is None:
        return jsonify({"error": "Organisation not found"}), 404

    guideline = BrandGuideline.query.filter_by(
        organisation_id=organisation_id
    ).order_by(BrandGuideline.id.desc()).first()

    if guideline is None:
        return jsonify({
            "error": "Please save basic guidelines before uploading a PDF"
        }), 404

    temp_path = None

    try:
        # Save uploaded PDF temporarily
        with tempfile.NamedTemporaryFile(
            suffix=".pdf",
            delete=False
        ) as temp_file:
            temp_path = temp_file.name
            uploaded_file.save(temp_path)

        # Extract text and generate chunks
        result = process_guideline_pdf(temp_path)

        if not result["success"]:
            return jsonify({"error": result["error"]}), 400

        # Save chunks in SQLite
        guideline.guideline_chunks = json.dumps(result["chunks"])

        db.session.commit()

        return jsonify({
            "message": "PDF guidelines processed successfully",
            "organisation_id": organisation_id,
            "total_pages": result["total_pages"],
            "total_chunks": result["total_chunks"]
        }), 200

    except Exception:
        db.session.rollback()
        return jsonify({"error": "Could not process PDF guidelines"}), 500

    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)
