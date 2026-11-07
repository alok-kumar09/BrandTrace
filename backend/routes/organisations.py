

from flask import Blueprint, request, jsonify
from database import db
from models import (
    Organisation,
    OrganisationMember,
    User,
    BrandGuideline,
    ReviewHistory
)
from flask_jwt_extended import jwt_required, get_jwt_identity
from services.access_control import organisation_member_required


organisations_bp = Blueprint("organisations", __name__)


# Register a new organisation
@organisations_bp.route("/api/organisations", methods=["POST"])
@jwt_required()
def create_organisation():

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Valid JSON is required"}), 400

    name = data.get("name")

    if not isinstance(name, str) or not name.strip():
        return jsonify({"error": "Organisation name is required"}), 400

    user_id = int(get_jwt_identity())

    user = db.session.get(User, user_id)

    if user is None:
        return jsonify({"error": "User not found"}), 404

    try:
        organisation = Organisation(name=name.strip())

        db.session.add(organisation)
        db.session.flush()

        # Make the creator the organisation Owner
        membership = OrganisationMember(
            user_id=user_id,
            organisation_id=organisation.id,
            role="Owner"
        )

        db.session.add(membership)
        db.session.commit()

        return jsonify({
            "message": "Organisation registered successfully",
            "organisation": {
                "id": organisation.id,
                "name": organisation.name,
                "role": "Owner"
            }
        }), 201

    except Exception:
        db.session.rollback()
        return jsonify({
            "error": "Could not register organisation"
        }), 500


# Retrieve organisation details
@organisations_bp.route(
    "/api/organisations/<int:organisation_id>",
    methods=["GET"]
)
@organisation_member_required
def get_organisation(organisation_id):

    organisation = db.session.get(
        Organisation,
        organisation_id
    )

    if organisation is None:
        return jsonify({"error": "Organisation not found"}), 404

    return jsonify({
        "id": organisation.id,
        "name": organisation.name,
        "created_at": (
            organisation.created_at.isoformat()
            if organisation.created_at else None
        )
    }), 200


# Retrieve organisation dashboard information
@organisations_bp.route(
    "/api/organisations/<int:organisation_id>/dashboard",
    methods=["GET"]
)
@organisation_member_required
def get_organisation_dashboard(organisation_id):

    organisation = db.session.get(
        Organisation,
        organisation_id
    )

    if organisation is None:
        return jsonify({"error": "Organisation not found"}), 404

    guideline = BrandGuideline.query.filter_by(
        organisation_id=organisation_id
    ).order_by(BrandGuideline.id.desc()).first()

    reviews = ReviewHistory.query.filter_by(
        organisation_id=organisation_id
    ).all()

    approved = sum(
        1 for review in reviews
        if review.overall_status == "Approved"
    )

    rejected = sum(
        1 for review in reviews
        if review.overall_status == "Rejected"
    )

    pending = sum(
        1 for review in reviews
        if review.overall_status == "Pending"
    )

    return jsonify({
        "organisation": {
            "id": organisation.id,
            "name": organisation.name
        },
        "guidelines_configured": guideline is not None,
        "review_statistics": {
            "total": len(reviews),
            "approved": approved,
            "rejected": rejected,
            "pending": pending
        }
    }), 200

