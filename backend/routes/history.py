from flask import Blueprint, jsonify
from backend.models import ReviewHistory
from backend.services.access_control import organisation_member_required
import json

history_bp = Blueprint("history", __name__)


@history_bp.route(
    "/api/history/<int:organisation_id>",
    methods=["GET"]
)
@history_bp.route(
    "/api/organisations/<int:organisation_id>/history",
    methods=["GET"]
)
@organisation_member_required
def get_history(organisation_id):

    try:
        history = ReviewHistory.query.filter_by(
            organisation_id=organisation_id
        ).order_by(
            ReviewHistory.created_at.desc()
        ).all()

        reviews = []

        for item in history:
            try:
                issues = json.loads(item.issues or "[]")
            except (json.JSONDecodeError, TypeError):
                issues = []

            try:
                suggestions = json.loads(item.suggestions or "[]")
            except (json.JSONDecodeError, TypeError):
                suggestions = []

            reviews.append({
                "id": item.id,
                "review_id": item.id,
                "submitted_content": item.submitted_content,
                "issues": issues,
                "suggestions": suggestions,
                "overall_status": item.overall_status,
                "created_at": (
                    item.created_at.isoformat()
                    if item.created_at else None
                )
            })

        return jsonify({
            "organisation_id": organisation_id,
            "total": len(reviews),
            "reviews": reviews,
            "history": reviews
        }), 200

    except Exception:
        return jsonify({
            "error": "Could not retrieve review history"
        }), 500