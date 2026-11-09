
from functools import wraps

from flask import jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from backend.database import db
from backend.models import Organisation, OrganisationMember


def get_organisation_id(kwargs):
    organisation_id = kwargs.get("organisation_id")

    if organisation_id is None:
        data = request.get_json(silent=True) or {}
        organisation_id = data.get("organisation_id")

    if isinstance(organisation_id, bool):
        return None

    try:
        organisation_id = int(organisation_id)
    except (TypeError, ValueError):
        return None

    if organisation_id <= 0:
        return None

    return organisation_id


def organisation_member_required(function):

    @wraps(function)
    @jwt_required()
    def wrapper(*args, **kwargs):

        organisation_id = get_organisation_id(kwargs)

        if organisation_id is None:
            return jsonify({
                "error": "Valid organisation_id is required"
            }), 400

        organisation = db.session.get(Organisation, organisation_id)

        if organisation is None:
            return jsonify({
                "error": "Organisation not found"
            }), 404

        user_id = int(get_jwt_identity())

        membership = OrganisationMember.query.filter_by(
            user_id=user_id,
            organisation_id=organisation_id
        ).first()

        if membership is None:
            return jsonify({
                "error": "You are not a member of this organisation"
            }), 403

        return function(*args, **kwargs)

    return wrapper


def organisation_admin_required(function):

    @wraps(function)
    @jwt_required()
    def wrapper(*args, **kwargs):

        organisation_id = get_organisation_id(kwargs)

        if organisation_id is None:
            return jsonify({
                "error": "Valid organisation_id is required"
            }), 400

        organisation = db.session.get(Organisation, organisation_id)

        if organisation is None:
            return jsonify({
                "error": "Organisation not found"
            }), 404

        user_id = int(get_jwt_identity())

        membership = OrganisationMember.query.filter_by(
            user_id=user_id,
            organisation_id=organisation_id
        ).first()

        if membership is None:
            return jsonify({
                "error": "You are not a member of this organisation"
            }), 403

        if membership.role not in ["Owner", "Admin"]:
            return jsonify({
                "error": "You do not have permission to perform this action"
            }), 403

        return function(*args, **kwargs)

    return wrapper
