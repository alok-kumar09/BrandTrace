import re
import uuid


def process_guideline_pages(pages, chunk_size=800, overlap=100):
    """
    Clean and split extracted guideline pages into chunks.
    """

    chunks = []

    for page in pages:
        page_number = page["page"]
        text = page["text"]

        # Remove unnecessary whitespace
        text = re.sub(r"\s+", " ", text).strip()

        if not text:
            continue

        # Split text into sentences
        sentences = re.split(r"(?<=[.!?])\s+", text)

        current_chunk = ""

        for sentence in sentences:
            sentence = sentence.strip()

            if not sentence:
                continue

            if len(current_chunk) + len(sentence) > chunk_size:
                if current_chunk:
                    chunks.append({
                        "id": str(uuid.uuid4()),
                        "page": page_number,
                        "text": current_chunk.strip()
                    })

                    # Keep a small overlap for context
                    current_chunk = current_chunk[-overlap:] + " "

            current_chunk += sentence + " "

        if current_chunk.strip():
            chunks.append({
                "id": str(uuid.uuid4()),
                "page": page_number,
                "text": current_chunk.strip()
            })

    return chunks