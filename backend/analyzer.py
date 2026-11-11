
import re
import uuid


def analyze_content(content, guidelines):
    """
    Perform deterministic brand guideline checks.

    Returns structured issues and suggestions with exact
    character positions in the original content.
    """

    issues = []
    suggestions = []

    restricted_words = guidelines.get("restricted_words", [])
    approved_terms = guidelines.get("approved_terms", [])
    approved_facts = guidelines.get("approved_facts", {})
    tone = guidelines.get("tone", "")

    def add_issue(
        category,
        severity,
        original_text,
        explanation,
        suggestion,
        rule_type,
        matched_value,
        start_offset=None,
        end_offset=None
    ):
        issue_id = str(uuid.uuid4())
        suggestion_id = str(uuid.uuid4())

        issues.append({
            "id": issue_id,
            "type": category,
            "category": category,
            "severity": severity,
            "message": explanation,
            "explanation": explanation,
            "evidence": original_text,
            "original_text": original_text,
            "start_offset": start_offset,
            "end_offset": end_offset,
            "suggestion": suggestion,
            "rule_reference": {
                "rule_type": rule_type,
                "matched_value": matched_value,
                "guideline_id": None
            }
        })

        suggestions.append({
            "id": suggestion_id,
            "issue_id": issue_id,
            "original": original_text,
            "replacement": suggestion,
            "start_offset": start_offset,
            "end_offset": end_offset
        })

    # 1. Restricted word detection
    for word in restricted_words:
        if not isinstance(word, str) or not word.strip():
            continue

        pattern = re.compile(
            r"\b" + re.escape(word) + r"\b",
            re.IGNORECASE
        )

        for match in pattern.finditer(content):
            add_issue(
                category="Terminology",
                severity="high",
                original_text=match.group(),
                explanation=(
                    f"Restricted phrase detected: '{match.group()}'."
                ),
                suggestion="Use an approved, verifiable statement.",
                rule_type="restricted_word",
                matched_value=word,
                start_offset=match.start(),
                end_offset=match.end()
            )

    # 2. Approved terminology checks
    for term in approved_terms:
        if not isinstance(term, str) or not term.strip():
            continue

        pattern = re.compile(
            r"\b" + re.escape(term) + r"\b",
            re.IGNORECASE
        )

        if not pattern.search(content):
            add_issue(
                category="Terminology",
                severity="low",
                original_text="",
                explanation=(
                    f"Approved term '{term}' is missing from the content."
                ),
                suggestion=f"Consider including the approved term '{term}'.",
                rule_type="approved_term",
                matched_value=term
            )

    # 3. Approved fact checks
    for subject, approved_fact in approved_facts.items():

        if not isinstance(subject, str) or not subject.strip():
            continue

        if not isinstance(approved_fact, str) or not approved_fact.strip():
            continue

        subject_matches = []

        # First check whether the complete subject exists.
        subject_pattern = re.compile(
            r"\b" + re.escape(subject) + r"\b",
            re.IGNORECASE
        )

        subject_matches = list(subject_pattern.finditer(content))

        # If the complete subject is not found, try separating
        # the product name from its attribute.
        if not subject_matches:

            subject_words = subject.split()

            for split_point in range(len(subject_words) - 1, 0, -1):

                product_name = " ".join(
                    subject_words[:split_point]
                )

                attribute = " ".join(
                    subject_words[split_point:]
                )

                product_pattern = re.compile(
                    r"\b" + re.escape(product_name) + r"\b",
                    re.IGNORECASE
                )

                attribute_pattern = re.compile(
                    r"\b" + re.escape(attribute) + r"\b",
                    re.IGNORECASE
                )

                product_matches = list(
                    product_pattern.finditer(content)
                )

                attribute_matches = list(
                    attribute_pattern.finditer(content)
                )

                if product_matches and attribute_matches:
                    subject_matches = product_matches
                    break

        # Check whether the approved fact is present.
        fact_pattern = re.compile(
            re.escape(approved_fact),
            re.IGNORECASE
        )

        if subject_matches and not fact_pattern.search(content):

            for match in subject_matches:

                add_issue(
                    category="Fact Verification",
                    severity="medium",
                    original_text=match.group(),
                    explanation=(
                        f"Verify the claim about '{subject}'. "
                        f"The approved fact is: {approved_fact}."
                    ),
                    suggestion=(
                        f"{match.group()}: {approved_fact}"
                    ),
                    rule_type="approved_fact",
                    matched_value=approved_fact,
                    start_offset=match.start(),
                    end_offset=match.end()
                )

    # 4. Determine overall review status
    overall_status = (
        "Needs Review" if issues else "Passed Initial Checks"
    )

    return {
        "issues": issues,
        "suggestions": suggestions,
        "overall_status": overall_status,
        "semantic_score": None
    }
