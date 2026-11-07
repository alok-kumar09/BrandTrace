
from database import db
from datetime import datetime, timezone


class Organisation(db.Model):

    __tablename__ = "organisations"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    name = db.Column(
        db.String(150),
        nullable=False
    )

    industry = db.Column(db.String(100), nullable=True)
    website = db.Column(db.String(255), nullable=True)
    governance_contact = db.Column(db.String(150), nullable=True)

    created_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )


class BrandGuideline(db.Model):

    __tablename__ = "brand_guidelines"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    organisation_id = db.Column(
        db.Integer,
        db.ForeignKey("organisations.id"),
        nullable=False
    )

    tone = db.Column(
        db.String(150),
        nullable=False
    )

    restricted_words = db.Column(
        db.Text,
        default=""
    )

    approved_terms = db.Column(
        db.Text,
        default=""
    )

    approved_facts = db.Column(
        db.Text,
        default=""
    )

    created_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )


class ReviewHistory(db.Model):

    __tablename__ = "review_history"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    organisation_id = db.Column(
        db.Integer,
        db.ForeignKey("organisations.id"),
        nullable=False
    )

    submitted_content = db.Column(
        db.Text,
        nullable=False
    )

    issues = db.Column(
        db.Text,
        default="[]"
    )

    suggestions = db.Column(
        db.Text,
        default="[]"
    )

    overall_status = db.Column(
        db.String(50),
        default="Pending"
    )

    created_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )


class User(db.Model):

    __tablename__ = "users"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    name = db.Column(
        db.String(150),
        nullable=False
    )

    email = db.Column(
        db.String(150),
        unique=True,
        nullable=False
    )

    password_hash = db.Column(
        db.String(256),
        nullable=False
    )

    created_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )


class OrganisationMember(db.Model):

    __tablename__ = "organisation_members"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False
    )

    organisation_id = db.Column(
        db.Integer,
        db.ForeignKey("organisations.id"),
        nullable=False
    )

    role = db.Column(
        db.String(30),
        nullable=False,
        default="Member"
    )

    created_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (
        db.UniqueConstraint(
            "user_id",
            "organisation_id",
            name="unique_user_organisation"
        ),
    )
