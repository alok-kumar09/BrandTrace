from flask import Blueprint, request, jsonify
from database import db
from models import Organisation, BrandGuideline, ReviewHistory
from services.access_control import organisation_member_required
import json

review_bp = Blueprint("review", __name__)


@review_bp.route("/api/analyze", methods=["POST"])
@organisation_member_required
def analyze():

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Valid JSON is required"}), 400

    organisation_id = data.get("organisation_id")
    content = data.get("content")

    if not isinstance(organisation_id, int) or isinstance(organisation_id, bool):
        return jsonify({"error": "Valid organisation_id is required"}), 400

    if not isinstance(content, str) or not content.strip():
        return jsonify({"error": "Content cannot be empty"}), 400

    try:
        organisation = db.session.get(Organisation, organisation_id)

        if organisation is None:
            return jsonify({"error": "Organisation not found"}), 404

        guideline = BrandGuideline.query.filter_by(
            organisation_id=organisation_id
        ).order_by(BrandGuideline.id.desc()).first()

        if guideline is None:
            return jsonify({"error": "No brand guidelines found"}), 404

        guidelines = {
            "tone": guideline.tone,
            "restricted_words": json.loads(guideline.restricted_words),
            "approved_terms": json.loads(guideline.approved_terms),
            "approved_facts": json.loads(guideline.approved_facts)
        }

        from analyzer import analyze_content

        result = analyze_content(content, guidelines)

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

        # Convert analyzer output into the frontend's expected format.
        frontend_issues = []

        for index, issue in enumerate(result["issues"]):
            if not isinstance(issue, dict):
                continue

            suggestion_data = (
                result["suggestions"][index]
                if index < len(result["suggestions"])
                and isinstance(result["suggestions"][index], dict)
                else {}
            )

            frontend_issues.append({
                "id": index + 1,
                "category": issue.get("type", "Issue"),
                "severity": str(issue.get("severity", "low")).lower(),
                "original_text": (
                    suggestion_data.get("original")
                    or issue.get("original_text")
                    or issue.get("evidence", "")
                ),
                "explanation": (
                    issue.get("evidence")
                    or issue.get("message", "")
                ),
                "suggestion": (
                    suggestion_data.get("replacement")
                    or issue.get("suggestion", "")
                )
            })

        # Save the frontend-compatible issues.
        review = ReviewHistory(
            organisation_id=organisation_id,
            submitted_content=content,
            issues=json.dumps(frontend_issues),
            suggestions=json.dumps(result["suggestions"]),
            overall_status=result["overall_status"]
        )

        db.session.add(review)
        db.session.commit()

        return jsonify({
            "review_id": review.id,
            "organisation_id": organisation_id,
            "issues": frontend_issues,
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