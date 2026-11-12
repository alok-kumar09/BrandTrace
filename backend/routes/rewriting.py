
from flask import Blueprint, request, jsonify

from backend.database import db
from backend.models import BrandGuideline, ReviewHistory
from backend.services.access_control import organisation_member_required
from backend.services.rewriting_service import rewrite_content

import json


rewriting_bp = Blueprint("rewriting", __name__)


@rewriting_bp.route("/api/rewrite", methods=["POST"])
@organisation_member_required
def rewrite():

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Valid JSON is required"}), 400

    organisation_id = data.get("organisation_id")
    review_id = data.get("review_id")
    selected_violation_ids = data.get("selected_violation_ids")

# Validate and normalize organisation ID
    if isinstance(organisation_id, bool):
        return jsonify({"error": "Valid organisation_id is required"}), 400

    if not isinstance(organisation_id, (int, str)):
        return jsonify({"error": "Valid organisation_id is required"}), 400

    try:
        organisation_id = int(organisation_id)
    except ValueError:
        return jsonify({"error": "Valid organisation_id is required"}), 400
    if organisation_id <= 0:
        return jsonify({"error": "Valid organisation_id is required"}), 400
    if not isinstance(review_id, int) or isinstance(review_id, bool):
        return jsonify({"error": "Valid review_id is required"}), 400

    if (
        not isinstance(selected_violation_ids, list)
        or not selected_violation_ids
        or not all(
            isinstance(item, str) and item.strip()
            for item in selected_violation_ids
        )
    ):
        return jsonify({
            "error": "Select at least one valid violation ID"
        }), 400

    if len(selected_violation_ids) != len(set(selected_violation_ids)):
        return jsonify({
            "error": "Duplicate violation IDs are not allowed"
        }), 400

    try:
        # 1. Retrieve the review
        review = db.session.get(ReviewHistory, review_id)

        if review is None or review.organisation_id != organisation_id:
            return jsonify({"error": "Review not found"}), 404

        # 2. Load saved issues
        issues = json.loads(review.issues or "[]")

        if not isinstance(issues, list):
            return jsonify({
                "error": "Stored review data is invalid"
            }), 500

        # 3. Match selected IDs against saved issues
        issues_by_id = {
            issue.get("id"): issue
            for issue in issues
            if isinstance(issue, dict) and issue.get("id")
        }

        if not all(
            violation_id in issues_by_id
            for violation_id in selected_violation_ids
        ):
            return jsonify({
                "error": "One or more selected violations were not found"
            }), 400

        selected_violations = [
            issues_by_id[violation_id]
            for violation_id in selected_violation_ids
        ]

        # 4. Retrieve organisation guidelines
        guideline = BrandGuideline.query.filter_by(
            organisation_id=organisation_id
        ).order_by(
            BrandGuideline.id.desc()
        ).first()

        if guideline is None:
            return jsonify({
                "error": "No brand guidelines found"
            }), 404

        # 5. Build structured guideline information
        structured_chunk = {
            "id": "structured-guidelines",
            "page": 1,
            "text": (
                "Brand tone: " + str(guideline.tone)
                + "\nRestricted words: " + (guideline.restricted_words or "")
                + "\nApproved terms: " + (guideline.approved_terms or "")
                + "\nApproved facts: " + (guideline.approved_facts or "")
            )
        }

        pdf_chunks = json.loads(guideline.guideline_chunks or "[]")

        if not isinstance(pdf_chunks, list):
            return jsonify({
                "error": "Stored guideline data is invalid"
            }), 500

        guideline_chunks = [structured_chunk] + pdf_chunks

        # 6. Generate revised content
        result = rewrite_content(
            original_content=review.submitted_content,
            selected_violations=selected_violations,
            guideline_chunks=guideline_chunks
        )

        if not result.get("success"):
            return jsonify({
                "error": result.get("error", "Rewriting failed")
            }), 503

        # 7. Return rewriting suggestions
        return jsonify({
            "review_id": review.id,
            "organisation_id": organisation_id,
            "provider": result.get("provider"),
            "original_content": result.get("original_content"),
            "revised_content": result.get("revised_content"),
            "suggestions": result.get("suggestions", [])
        }), 200

    except (json.JSONDecodeError, TypeError):
        return jsonify({
            "error": "Stored review or guideline data is invalid"
        }), 500

    except Exception as e:
        db.session.rollback()
        print("Content rewriting error:", str(e))

        return jsonify({
            "error": "Content rewriting failed"
        }), 500
