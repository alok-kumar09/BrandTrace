
import re


def retrieve_relevant_guidelines(content, chunks, top_k=3):
    """
    Retrieve relevant guideline chunks using keyword matching.

    The structured-guidelines chunk is always included.
    Remaining slots are filled with the most relevant PDF chunks.
    """

    if not content or not chunks:
        return []

    content_words = set(
        re.findall(r"\b[a-zA-Z0-9]+\b", content.lower())
    )

    structured_chunk = None
    pdf_results = []

    for chunk in chunks:

        if not isinstance(chunk, dict):
            continue

        guideline_text = chunk.get("text", "")

        if not isinstance(guideline_text, str):
            continue

        # Always preserve structured guidelines
        if chunk.get("id") == "structured-guidelines":
            structured_chunk = {
                "id": chunk.get("id"),
                "page": chunk.get("page", 1),
                "text": guideline_text,
                "score": 0,
                "matched_keywords": []
            }
            continue

        guideline_words = set(
            re.findall(r"\b[a-zA-Z0-9]+\b", guideline_text.lower())
        )

        matched_words = content_words.intersection(guideline_words)
        score = len(matched_words)

        if score > 0:
            pdf_results.append({
                "id": chunk.get("id"),
                "page": chunk.get("page"),
                "text": guideline_text,
                "score": score,
                "matched_keywords": sorted(matched_words)
            })

    # Highest relevance first
    pdf_results.sort(
        key=lambda item: item["score"],
        reverse=True
    )

    # Reserve one slot for structured guidelines
    if structured_chunk is not None:
        remaining_slots = max(0, top_k - 1)

        return (
            [structured_chunk]
            + pdf_results[:remaining_slots]
        )

    return pdf_results[:top_k]
