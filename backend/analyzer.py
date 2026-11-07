
import re


def analyze_content(content, guidelines):

    issues = []
    suggestions = []

    prohibited_words = guidelines.get("restricted_words", [])

    for word in prohibited_words:

        if not isinstance(word, str) or not word.strip():
            continue

        word = word.strip().lower()
        variants = {word}

        # Handle common word variations
        if word.endswith("ed"):
            base = word[:-1]
            variants.add(base)
            variants.add(base + "s")

        if word.endswith("s"):
            variants.add(word[:-1])

        if word.endswith("est"):
            variants.add(word[:-3])

        # Find every occurrence of every variation
        matches = []

        for variant in variants:

            if not variant:
                continue

            pattern = rf"\b{re.escape(variant)}\b"

            for match in re.finditer(
                pattern,
                content,
                flags=re.IGNORECASE
            ):
                matches.append(match)

        # Sort matches by their position in the content
        matches.sort(key=lambda match: match.start())

        # Avoid duplicate matches at the same position
        seen_positions = set()

        for match in matches:

            if match.start() in seen_positions:
                continue

            seen_positions.add(match.start())

            detected_word = match.group()

            issues.append({
                "type": "Terminology",
                "severity": "High",
                "message": f"Prohibited phrase detected: '{detected_word}'",
                "evidence": f"'{word}' is restricted by the brand guidelines."
            })

            suggestions.append({
                "original": detected_word,
                "replacement": "Use an approved, verifiable statement."
            })

    return {
        "issues": issues,
        "suggestions": suggestions,
        "overall_status": "Needs Review" if issues else "Passed Initial Checks"
    }
