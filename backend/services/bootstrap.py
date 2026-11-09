"""Idempotent first-run setup: tables, demo organisation, demo admin, default guidelines.

Safe to call on every start-up. Nothing is overwritten if it already exists.
"""
import json

from werkzeug.security import generate_password_hash

from backend.database import db
from backend.models import Organisation, OrganisationMember, User, BrandGuideline

DEMO_ORG_ID = 1
DEMO_ORG_NAME = "NovaTech Devices"
DEMO_ADMIN_EMAIL = "admin@brandtrace.demo"
DEMO_ADMIN_PASSWORD = "Demo@12345"

DEFAULT_GUIDELINES = {
    "tone": "Confident, clear and customer-friendly. Avoid superlatives and unverifiable claims.",
    "restricted_words": ["Cheapest", "Best in class", "Guaranteed"],
    "approved_terms": [],
    "approved_facts": {
        "NovaBook Pro battery life": "Up to 12 hours",
        "NovaBook Pro display": "14-inch 2.8K OLED",
        "NovaBook Pro weight": "1.3 kg",
    },
}


def bootstrap():
    db.create_all()

    org = db.session.get(Organisation, DEMO_ORG_ID)
    if org is None:
        org = Organisation(id=DEMO_ORG_ID, name=DEMO_ORG_NAME,
                           industry="Consumer Electronics")
        db.session.add(org)
        db.session.flush()

    admin = User.query.filter_by(email=DEMO_ADMIN_EMAIL).first()
    if admin is None:
        admin = User(name="Demo Admin", email=DEMO_ADMIN_EMAIL,
                     password_hash=generate_password_hash(DEMO_ADMIN_PASSWORD))
        db.session.add(admin)
        db.session.flush()

    member = OrganisationMember.query.filter_by(
        user_id=admin.id, organisation_id=org.id).first()
    if member is None:
        db.session.add(OrganisationMember(
            user_id=admin.id, organisation_id=org.id, role="Owner"))

    has_guidelines = BrandGuideline.query.filter_by(
        organisation_id=org.id).first()
    if has_guidelines is None:
        g = DEFAULT_GUIDELINES
        db.session.add(BrandGuideline(
            organisation_id=org.id,
            tone=g["tone"],
            restricted_words=json.dumps(g["restricted_words"]),
            approved_terms=json.dumps(g["approved_terms"]),
            approved_facts=json.dumps(g["approved_facts"]),
        ))

    db.session.commit()
