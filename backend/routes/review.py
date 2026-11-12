
from flask import Blueprint, request, jsonify

from backend.database import db
from backend.models import Organisation, BrandGuideline, ReviewHistory
from backend.services.access_control import organisation_member_required
from backend.services.ai_analyzer import run_ai_analysis

import json


review_bp = Blueprint("review", __name__)


@review_bp.route("/api/analyze", methods=["POST"])
@organisation_member_required
def analyze():

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({
            "error": "Valid JSON is required"
        }), 400

    organisation_id = data.get("organisation_id")
    content = data.get("content")

    if not isinstance(organisation_id, int) or isinstance(organisation_id, bool):
        return jsonify({
            "error": "Valid organisation_id is required"
        }), 400

    if not isinstance(content, str) or not content.strip():
        return jsonify({
            "error": "Content cannot be empty"
        }), 400

    try:
        # Step 1: Verify organisation
        organisation = db.session.get(
            Organisation,
            organisation_id
        )

        if organisation is None:
            return jsonify({
                "error": "Organisation not found"
            }), 404

        # Step 2: Retrieve the latest brand guidelines
        guideline = BrandGuideline.query.filter_by(
            organisation_id=organisation_id
        ).order_by(
            BrandGuideline.id.desc()
        ).first()

        if guideline is None:
            return jsonify({
                "error": "No brand guidelines found"
            }), 404

        # Step 3: Load structured guidelines
        structured_guidelines = {
            "tone": guideline.tone,
            "restricted_words": json.loads(
                guideline.restricted_words or "[]"
            ),
            "approved_terms": json.loads(
                guideline.approved_terms or "[]"
            ),
            "approved_facts": json.loads(
                guideline.approved_facts or "{}"
            )
        }

        # Step 4: Load guideline chunks extracted from PDF
        guideline_chunks = json.loads(
            guideline.guideline_chunks or "[]"
        )

        if not isinstance(guideline_chunks, list):
            return jsonify({
                "error": "Stored guideline data is invalid"
            }), 500

        # Step 5: Convert structured guidelines into a text chunk
        structured_chunk = {
            "id": "structured-guidelines",
            "page": 1,
            "text": (
                "Brand tone: "
                + str(structured_guidelines["tone"])
                + "\nRestricted words: "
                + json.dumps(
                    structured_guidelines["restricted_words"]
                )
                + "\nApproved terms: "
                + json.dumps(
                    structured_guidelines["approved_terms"]
                )
                + "\nApproved facts: "
                + json.dumps(
                    structured_guidelines["approved_facts"]
                )
            )
        }

        # Combine structured guidelines and PDF chunks
        all_guideline_chunks = [
            structured_chunk
        ] + guideline_chunks

        # Step 6: Run Groq-powered AI analysis
        result = run_ai_analysis(
            content,
            all_guideline_chunks
        )

        if not isinstance(result, dict) or not result.get("success"):
            return jsonify({
                "error": (
                    result.get("error", "AI analysis failed.")
                    if isinstance(result, dict)
                    else "Invalid AI analysis response."
                )
            }), 503

        # Step 7: Validate AI response
        required_keys = [
            "issues",
            "suggestions",
            "overall_status"
        ]

        if not all(key in result for key in required_keys):
            raise ValueError("Missing analyzer response fields")

        if not isinstance(result["issues"], list):
            raise ValueError("Issues must be a list")

        if not isinstance(result["suggestions"], list):
            raise ValueError("Suggestions must be a list")

        if not isinstance(result["overall_status"], str):
            raise ValueError("Invalid review status")

        # Step 8: Match suggestions using issue IDs
        suggestions_by_issue = {}

        for suggestion in result["suggestions"]:

            if not isinstance(suggestion, dict):
                continue

            issue_id = suggestion.get("issue_id")

            if issue_id:
                suggestions_by_issue[issue_id] = suggestion

        # Step 9: Prepare frontend-compatible issues
        frontend_issues = []

        for issue in result["issues"]:

            if not isinstance(issue, dict):
                continue

            issue_id = issue.get("id")

            suggestion_data = suggestions_by_issue.get(
                issue_id,
                {}
            )

            frontend_issues.append({
                "id": issue_id,

                "category": issue.get(
                    "category",
                    issue.get("type", "Issue")
                ),

                "severity": str(
                    issue.get("severity", "low")
                ).lower(),

                "original_text": issue.get(
                    "original_text",
                    issue.get("evidence", "")
                ),

                "start_offset": issue.get("start_offset"),
                "end_offset": issue.get("end_offset"),

                "explanation": issue.get(
                    "explanation",
                    issue.get("message", "")
                ),

                "suggestion": suggestion_data.get(
                    "replacement",
                    issue.get("suggestion", "")
                ),

                "rule_reference": issue.get("rule_reference")
            })

        # Step 10: Save review results in database
        review = ReviewHistory(
            organisation_id=organisation_id,
            submitted_content=content,
            issues=json.dumps(frontend_issues),
            suggestions=json.dumps(result["suggestions"]),
            overall_status=result["overall_status"]
        )

        db.session.add(review)
        db.session.commit()

        # Step 11: Return results to frontend
        return jsonify({
            "review_id": review.id,
            "organisation_id": organisation_id,
            "provider": result.get("provider"),
            "analysis_mode": result.get("analysis_mode"),
            "issues": frontend_issues,
            "suggestions": result["suggestions"],
            "overall_status": result["overall_status"],
            "semantic_score": result.get("semantic_score")
        }), 200

    except Exception as e:
        db.session.rollback()

        print("Content analysis error:", str(e))

        return jsonify({
            "error": "Content analysis failed"
        }), 500
