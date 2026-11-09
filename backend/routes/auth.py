from flask import Blueprint, request, jsonify
from backend.database import db
from backend.models import User, Organisation, OrganisationMember
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import (
    create_access_token,
    jwt_required,
    get_jwt_identity
)

auth_bp = Blueprint("auth", __name__)

DEFAULT_ORG_ID = 1


def _session_payload(user, membership, organisation):
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": membership.role if membership else None,
        "organisation_id": organisation.id if organisation else None,
        "organisation_name": organisation.name if organisation else None,
    }


def _membership_for(user):
    """Return (membership, organisation). Attach legacy users without a
    membership to the default organisation so they are never locked out."""
    membership = OrganisationMember.query.filter_by(
        user_id=user.id).order_by(OrganisationMember.id).first()
    if membership is None:
        organisation = db.session.get(Organisation, DEFAULT_ORG_ID)
        if organisation is None:
            return None, None
        membership = OrganisationMember(
            user_id=user.id, organisation_id=organisation.id, role="Member")
        db.session.add(membership)
        db.session.commit()
        return membership, organisation
    return membership, db.session.get(Organisation, membership.organisation_id)


# Register a new user
@auth_bp.route("/api/auth/register", methods=["POST"])
def register():

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Valid JSON is required"}), 400

    name = data.get("name")
    email = data.get("email")
    password = data.get("password")

    if not isinstance(name, str) or not name.strip():
        return jsonify({"error": "Name is required"}), 400

    if not isinstance(email, str) or "@" not in email:
        return jsonify({"error": "Valid email is required"}), 400

    if not isinstance(password, str) or len(password) < 8:
        return jsonify({
            "error": "Password must contain at least 8 characters"
        }), 400

    email = email.strip().lower()

    try:
        existing_user = User.query.filter_by(email=email).first()

        if existing_user:
            return jsonify({
                "error": "An account with this email already exists"
            }), 409

        # Find the demo organisation.
        organisation = db.session.get(Organisation, 1)

        if organisation is None:
            return jsonify({
                "error": "Demo organisation is not configured"
            }), 500

        # Create the user.
        user = User(
            name=name.strip(),
            email=email,
            password_hash=generate_password_hash(password)
        )

        db.session.add(user)
        db.session.flush()

        # First registered user becomes Owner.
        existing_members = OrganisationMember.query.filter_by(
            organisation_id=1
        ).count()

        role = "Owner" if existing_members == 0 else "Member"

        membership = OrganisationMember(
            user_id=user.id,
            organisation_id=1,
            role=role
        )

        db.session.add(membership)
        db.session.commit()

        access_token = create_access_token(
            identity=str(user.id)
        )

        return jsonify({
            "message": "User registered successfully",
            "access_token": access_token,
            "user": _session_payload(user, membership, organisation)
        }), 201

    except Exception:
        db.session.rollback()
        return jsonify({
            "error": "Could not register user"
        }), 500


# Login an existing user
@auth_bp.route("/api/auth/login", methods=["POST"])
def login():

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Valid JSON is required"}), 400

    email = data.get("email")
    password = data.get("password")

    if not isinstance(email, str) or not isinstance(password, str):
        return jsonify({"error": "Email and password are required"}), 400

    email = email.strip().lower()

    user = User.query.filter_by(email=email).first()

    if user is None or not check_password_hash(
        user.password_hash,
        password
    ):
        return jsonify({"error": "Invalid email or password"}), 401

    access_token = create_access_token(
        identity=str(user.id)
    )

    membership, organisation = _membership_for(user)

    return jsonify({
        "message": "Login successful",
        "access_token": access_token,
        "user": _session_payload(user, membership, organisation)
    }), 200


# Get current logged-in user
@auth_bp.route("/api/auth/me", methods=["GET"])
@jwt_required()
def get_current_user():

    user_id = int(get_jwt_identity())

    user = db.session.get(User, user_id)

    if user is None:
        return jsonify({"error": "User not found"}), 404

    membership, organisation = _membership_for(user)

    return jsonify(_session_payload(user, membership, organisation)), 200
