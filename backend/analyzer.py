
import re


def analyze_content(content, guidelines):

    issues = []
    suggestions = []

    restricted_words = guidelines.get("restricted_words", [])
    approved_terms = guidelines.get("approved_terms", [])
    approved_facts = guidelines.get("approved_facts", {})
    tone = guidelines.get("tone", "")

    # 1. Check restricted words and phrases
    for word in restricted_words:

        if not isinstance(word, str) or not word.strip():
            continue

        word = word.strip()

        pattern = rf"\b{re.escape(word)}\b"

        for match in re.finditer(pattern, content, re.IGNORECASE):

            detected_word = match.group()

            issues.append({
                "type": "Terminology",
                "severity": "High",
                "message": f"Restricted phrase detected: '{detected_word}'",
                "evidence": (
                    f"'{word}' is restricted by the brand guidelines."
                )
            })

            suggestions.append({
                "original": detected_word,
                "replacement": "Use an approved, verifiable statement."
            })

    # 2. Check approved terminology
    if isinstance(approved_terms, list):

        for term in approved_terms:

            if not isinstance(term, str) or not term.strip():
                continue

            pattern = rf"\b{re.escape(term.strip())}\b"

            if not re.search(pattern, content, re.IGNORECASE):
                issues.append({
                    "type": "Terminology",
                    "severity": "Low",
                    "message": f"Approved brand term '{term}' was not found.",
                    "evidence": (
                        f"Consider using the approved term '{term}' "
                        "where relevant."
                    )
                })

                suggestions.append({
                    "original": "",
                    "replacement": (
                        f"Consider using '{term}' where relevant."
                    )
                })

    # 3. Check approved facts
    if isinstance(approved_facts, dict):

        for subject, fact in approved_facts.items():

            if not isinstance(subject, str):
                continue

            if not isinstance(fact, str):
                continue

            subject = subject.strip()
            fact = fact.strip()

            if not subject or not fact:
                continue

            # Check whether the subject is mentioned.
            if re.search(
                rf"\b{re.escape(subject)}\b",
                content,
                re.IGNORECASE
            ):

                # Flag for human verification if the approved fact
                # is not present in the submitted content.
                if not re.search(
                    re.escape(fact),
                    content,
                    re.IGNORECASE
                ):

                    issues.append({
                        "type": "Fact Verification",
                        "severity": "Medium",
                        "message": (
                            f"Verify the claim about '{subject}'."
                        ),
                        "evidence": (
                            f"The approved fact is: {fact}. "
                            "Check that the submitted claim is consistent."
                        )
                    })

                    suggestions.append({
                        "original": subject,
                        "replacement": (
                            f"{subject}: {fact}"
                        )
                    })

    # 4. Return analysis results
    return {
        "issues": issues,
        "suggestions": suggestions,
        "overall_status": (
            "Needs Review" if issues else "Passed Initial Checks"
        )
    }
