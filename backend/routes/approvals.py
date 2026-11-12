from flask import Blueprint, request, jsonify
from backend.database import db
from backend.models import Organisation, ReviewHistory
from backend.services.access_control import organisation_admin_required
import json

approvals_bp = Blueprint("approvals", __name__)


@approvals_bp.route(
    "/api/approvals/<int:review_id>",
    methods=["PUT"]
)
@organisation_admin_required
def update_approval(review_id):

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Valid JSON is required"}), 400

    # Accept both frontend and backend field names.
    status = data.get("approval_status", data.get("status"))
    organisation_id = data.get("organisation_id")

    if isinstance(status, str):
        status = status.strip().lower()

    status_mapping = {
        "approved": "Approved",
        "rejected": "Rejected"
    }

    if status not in status_mapping:
        return jsonify({
            "error": "Approval status must be approved or rejected"
        }), 400

    if not isinstance(organisation_id, int) or isinstance(organisation_id, bool):
        return jsonify({"error": "Valid organisation_id is required"}), 400

    try:
        organisation = db.session.get(
            Organisation,
            organisation_id
        )

        if organisation is None:
            return jsonify({"error": "Organisation not found"}), 404

        review = ReviewHistory.query.filter_by(
            id=review_id,
            organisation_id=organisation_id
        ).first()

        if review is None:
            return jsonify({"error": "Review not found"}), 404

        review.overall_status = status_mapping[status]

        db.session.commit()

        return jsonify({
            "message": "Review decision saved successfully",
            "review_id": review.id,
            "organisation_id": organisation_id,
            "status": review.overall_status
        }), 200

    except Exception:
        db.session.rollback()
        return jsonify({
            "error": "Could not save review decision"
        }), 500
@approvals_bp.route(
    "/api/approvals/<int:review_id>/suggestions/<string:suggestion_id>",
    methods=["PUT"]
)
@organisation_admin_required
def update_suggestion_approval(review_id, suggestion_id):

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Valid JSON is required"}), 400

    status = data.get("status")
    organisation_id = data.get("organisation_id")

    if isinstance(status, str):
        status = status.strip().lower()

    if status not in ["approved", "rejected"]:
        return jsonify({"error": "Status must be approved or rejected"}), 400

    if not isinstance(organisation_id, int) or isinstance(organisation_id, bool):
        return jsonify({"error": "Valid organisation_id is required"}), 400

    try:
        review = ReviewHistory.query.filter_by(
            id=review_id,
            organisation_id=organisation_id
        ).first()

        if review is None:
            return jsonify({"error": "Review not found"}), 404

        suggestions = json.loads(review.suggestions or "[]")

        if not isinstance(suggestions, list):
            return jsonify({"error": "Invalid stored suggestions"}), 500

        suggestion = next(
            (
                item for item in suggestions
                if isinstance(item, dict)
                and item.get("id") == suggestion_id
            ),
            None
        )

        if suggestion is None:
            return jsonify({"error": "Suggestion not found"}), 404

        suggestion["status"] = status

        review.suggestions = json.dumps(suggestions)

        db.session.commit()

        return jsonify({
            "message": "Suggestion decision saved successfully",
            "review_id": review.id,
            "suggestion_id": suggestion_id,
            "status": status
        }), 200

    except Exception:
        db.session.rollback()
        return jsonify({"error": "Could not save suggestion decision"}), 500