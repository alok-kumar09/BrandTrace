from flask import Blueprint, jsonify

from backend.models import ReviewHistory
from backend.services.access_control import organisation_member_required

import json


analytics_bp = Blueprint("analytics", __name__)


@analytics_bp.route(
    "/api/analytics/<int:organisation_id>",
    methods=["GET"]
)
@organisation_member_required
def get_analytics(organisation_id):

    try:
        reviews = ReviewHistory.query.filter_by(
            organisation_id=organisation_id
        ).all()

        total_reviews = len(reviews)
        total_violations = 0
        compliant_reviews = 0

        for review in reviews:

            try:
                issues = json.loads(review.issues or "[]")

                if not isinstance(issues, list):
                    issues = []

            except (json.JSONDecodeError, TypeError):
                issues = []

            violation_count = len(issues)

            total_violations += violation_count

            if violation_count == 0:
                compliant_reviews += 1

        compliance_rate = (
            round((compliant_reviews / total_reviews) * 100, 2)
            if total_reviews > 0
            else 0
        )

        return jsonify({
            "organisation_id": organisation_id,
            "total_reviews": total_reviews,
            "total_violations": total_violations,
            "compliant_reviews": compliant_reviews,
            "compliance_rate": compliance_rate
        }), 200

    except Exception as e:

        print("Analytics error:", str(e))

        return jsonify({
            "error": "Could not generate analytics"
        }), 500
@analytics_bp.route(
    "/api/analytics/<int:organisation_id>/categories",
    methods=["GET"]
)
@organisation_member_required
def get_category_analytics(organisation_id):

    try:
        reviews = ReviewHistory.query.filter_by(
            organisation_id=organisation_id
        ).all()

        category_counts = {}

        for review in reviews:

            try:
                issues = json.loads(review.issues or "[]")
            except (json.JSONDecodeError, TypeError):
                continue

            if not isinstance(issues, list):
                continue

            for issue in issues:

                if not isinstance(issue, dict):
                    continue

                category = issue.get("category", "Uncategorized")

                if not isinstance(category, str) or not category.strip():
                    category = "Uncategorized"

                category = category.strip().title()

                category_counts[category] = (
                    category_counts.get(category, 0) + 1
                )

        return jsonify({
            "organisation_id": organisation_id,
            "categories": [
                {
                    "category": category,
                    "count": count
                }
                for category, count in sorted(
                    category_counts.items()
                )
            ]
        }), 200

    except Exception as e:

        print("Category analytics error:", str(e))

        return jsonify({
            "error": "Could not generate category analytics"
        }), 500
@analytics_bp.route(
    "/api/analytics/<int:organisation_id>/severity",
    methods=["GET"]
)
@organisation_member_required
def get_severity_analytics(organisation_id):

    try:
        reviews = ReviewHistory.query.filter_by(
            organisation_id=organisation_id
        ).all()

        severity_counts = {
            "High": 0,
            "Medium": 0,
            "Low": 0
        }

        for review in reviews:

            try:
                issues = json.loads(review.issues or "[]")
            except (json.JSONDecodeError, TypeError):
                continue

            if not isinstance(issues, list):
                continue

            for issue in issues:

                if not isinstance(issue, dict):
                    continue

                severity = issue.get("severity", "Low")

                if not isinstance(severity, str):
                    continue

                severity = severity.strip().title()

                if severity in severity_counts:
                    severity_counts[severity] += 1

        return jsonify({
            "organisation_id": organisation_id,
            "severity": [
                {
                    "severity": level,
                    "count": count
                }
                for level, count in severity_counts.items()
            ]
        }), 200

    except Exception as e:

        print("Severity analytics error:", str(e))

        return jsonify({
            "error": "Could not generate severity analytics"
        }), 500
@analytics_bp.route(
    "/api/analytics/<int:organisation_id>/trends",
    methods=["GET"]
)
@organisation_member_required
def get_review_trends(organisation_id):

    try:
        reviews = ReviewHistory.query.filter_by(
            organisation_id=organisation_id
        ).all()

        daily_trends = {}

        for review in reviews:

            if not review.created_at:
                continue

            date = review.created_at.strftime("%Y-%m-%d")

            if date not in daily_trends:
                daily_trends[date] = {
                    "date": date,
                    "total_reviews": 0,
                    "total_violations": 0
                }

            daily_trends[date]["total_reviews"] += 1

            try:
                issues = json.loads(review.issues or "[]")
            except (json.JSONDecodeError, TypeError):
                issues = []

            if isinstance(issues, list):
                daily_trends[date]["total_violations"] += sum(
                    1 for issue in issues
                    if isinstance(issue, dict)
                )

        return jsonify({
            "organisation_id": organisation_id,
            "trends": sorted(
                daily_trends.values(),
                key=lambda item: item["date"]
            )
        }), 200

    except Exception as e:

        print("Review trends error:", str(e))

        return jsonify({
            "error": "Could not generate review trends"
        }), 500