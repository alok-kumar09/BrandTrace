
from flask import Blueprint, jsonify
from models import ReviewHistory
from services.access_control import organisation_member_required

history_bp = Blueprint("history", __name__)


@history_bp.route(
    "/api/history/<int:organisation_id>",
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

        return jsonify({
            "organisation_id": organisation_id,
            "total": len(history),
            "history": [
                {
                    "id": item.id,
                    "submitted_content": item.submitted_content,
                    "issues": item.issues,
                    "suggestions": item.suggestions,
                    "overall_status": item.overall_status,
                    "created_at": (
                        item.created_at.isoformat()
                        if item.created_at else None
                    )
                }
                for item in history
            ]
        }), 200

    except Exception:
        return jsonify({
            "error": "Could not retrieve review history"
        }), 500
