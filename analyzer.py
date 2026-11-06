def analyze_content(content, guidelines):

    issues = []
    suggestions = []

    content_lower = content.lower()

    # Get restricted words from the organisation's guidelines
    prohibited_words = guidelines.get("restricted_words", [])

    for word in prohibited_words:

        if word.lower() in content_lower:

            issues.append({
                "type": "Terminology",
                "severity": "High",
                "message": f"Prohibited phrase detected: '{word}'",
                "evidence": f"'{word}' is restricted by the brand guidelines."
            })

            suggestions.append({
                "original": word,
                "replacement": "Use an approved, verifiable statement."
            })

    return {
        "issues": issues,
        "suggestions": suggestions,
        "overall_status": "Needs Review" if issues else "Passed Initial Checks"
    }