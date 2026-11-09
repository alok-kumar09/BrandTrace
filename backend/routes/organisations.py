

from flask import Blueprint, request, jsonify
from backend.database import db
from backend.models import (
    Organisation,
    OrganisationMember,
    User,
    BrandGuideline,
    ReviewHistory
)
from flask_jwt_extended import jwt_required, get_jwt_identity
from backend.services.access_control import (
    organisation_member_required,
    organisation_admin_required
)

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

    organisation = db.session.get(Organisation, organisation_id)

    if organisation is None:
        return jsonify({"error": "Organisation not found"}), 404

    memberships = OrganisationMember.query.filter_by(
        organisation_id=organisation_id
    ).all()

    members = []
    for membership in memberships:
        user = db.session.get(User, membership.user_id)
        if user is not None:
            members.append({
                "user_id": user.id,
                "name": user.name,
                "email": user.email,
                "role": membership.role,
                "created_at": (
                    membership.created_at.isoformat()
                    if membership.created_at else None
                )
            })

    return jsonify({
        "id": organisation.id,
        "name": organisation.name,
        "industry": organisation.industry,
        "website": organisation.website,
        "governance_contact": organisation.governance_contact,
        "members": members,
        "created_at": (
            organisation.created_at.isoformat()
            if organisation.created_at else None
        )
    }), 200


@organisations_bp.route("/api/organisations/<int:organisation_id>", methods=["PUT"])
@organisation_admin_required
def update_organisation(organisation_id):
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Valid JSON is required"}), 400
    organisation = Organisation.query.get_or_404(organisation_id)
    if "org_name" in data:
        name = data["org_name"]
        if not isinstance(name, str) or not name.strip():
            return jsonify({"error": "Organisation name is required"}), 400
        organisation.name = name.strip()
    for key, field in [("industry", "industry"), ("website", "website"), ("contact", "governance_contact")]:
        if key in data:
            value = data[key]
            if value is not None and not isinstance(value, str):
                return jsonify({"error": key + " must be text"}), 400
            setattr(organisation, field, value.strip() if isinstance(value, str) else None)
    db.session.commit()
    return jsonify({"message": "Organisation updated successfully", "organisation": {"id": organisation.id, "name": organisation.name, "industry": organisation.industry, "website": organisation.website, "governance_contact": organisation.governance_contact}}), 200


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

# Add an existing user to an organisation
@organisations_bp.route(
    "/api/organisations/<int:organisation_id>/members",
    methods=["POST"]
)
@organisation_admin_required
def add_organisation_member(organisation_id):

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Valid JSON is required"}), 400

    email = data.get("email")

    if not isinstance(email, str) or not email.strip():
        return jsonify({"error": "Valid user email is required"}), 400

    email = email.strip().lower()

    user = User.query.filter(
        db.func.lower(User.email) == email
    ).first()

    if user is None:
        return jsonify({"error": "User does not exist"}), 404

    existing_member = OrganisationMember.query.filter_by(
        user_id=user.id,
        organisation_id=organisation_id
    ).first()

    if existing_member is not None:
        return jsonify({
            "error": "User is already a member of this organisation"
        }), 409

    try:
        membership = OrganisationMember(
            user_id=user.id,
            organisation_id=organisation_id,
            role="Member"
        )

        db.session.add(membership)
        db.session.commit()

        return jsonify({
            "message": "User added successfully",
            "member": {
                "user_id": user.id,
                "name": user.name,
                "email": user.email,
                "role": membership.role
            }
        }), 201

    except Exception:
        db.session.rollback()
        return jsonify({
            "error": "Could not add organisation member"
        }), 500