

from flask import Blueprint, request, jsonify
from database import db
from models import Organisation, BrandGuideline, ReviewHistory
import json
from services.access_control import organisation_member_required

review_bp = Blueprint("review", __name__)


@review_bp.route("/api/analyze", methods=["POST"])
@organisation_member_required
def analyze():

    data = request.get_json(silent=True)

    # Validate incoming request
    if not isinstance(data, dict):
        return jsonify({"error": "Valid JSON is required"}), 400

    organisation_id = data.get("organisation_id")
    content = data.get("content")

    if not isinstance(organisation_id, int) or isinstance(organisation_id, bool):
        return jsonify({"error": "Valid organisation_id is required"}), 400

    if not isinstance(content, str) or not content.strip():
        return jsonify({"error": "Content cannot be empty"}), 400

    try:
        # Find organisation
        organisation = db.session.get(Organisation, organisation_id)

        if organisation is None:
            return jsonify({"error": "Organisation not found"}), 404

        # Retrieve saved guidelines
        guideline = BrandGuideline.query.filter_by(
            organisation_id=organisation_id
        ).order_by(BrandGuideline.id.desc()).first()

        if guideline is None:
            return jsonify({"error": "No brand guidelines found"}), 404

        # Convert stored JSON text into Python data
        guidelines = {
            "tone": guideline.tone,
            "restricted_words": json.loads(guideline.restricted_words),
            "approved_terms": json.loads(guideline.approved_terms),
            "approved_facts": json.loads(guideline.approved_facts)
        }

        # Connect to teammate's analyzer
        from analyzer import analyze_content

        result = analyze_content(content, guidelines)

        # Validate analyzer response
        required_keys = ["issues", "suggestions", "overall_status"]

        if not isinstance(result, dict):
            raise ValueError("Invalid analyzer response")

        if not all(key in result for key in required_keys):
            raise ValueError("Missing analyzer response fields")

        if not isinstance(result["issues"], list):
            raise ValueError("Issues must be a list")

        if not isinstance(result["suggestions"], list):
            raise ValueError("Suggestions must be a list")

        if not isinstance(result["overall_status"], str):
            raise ValueError("Invalid review status")

        # Save review history
        review = ReviewHistory(
            organisation_id=organisation_id,
            submitted_content=content,
            issues=json.dumps(result["issues"]),
            suggestions=json.dumps(result["suggestions"]),
            overall_status=result["overall_status"]
        )

        db.session.add(review)
        db.session.commit()

        # Return results to frontend
        return jsonify({
            "review_id": review.id,
            "organisation_id": organisation_id,
            "issues": result["issues"],
            "suggestions": result["suggestions"],
            "overall_status": result["overall_status"]
        }), 200

    except ModuleNotFoundError as error:
        db.session.rollback()

        if error.name == "analyzer":
            return jsonify({
                "error": "Analysis engine is not integrated yet"
            }), 503

        return jsonify({
            "error": "An analyzer dependency is missing"
        }), 500

    except Exception:
        db.session.rollback()
        return jsonify({
            "error": "Content analysis failed"
        }), 500
