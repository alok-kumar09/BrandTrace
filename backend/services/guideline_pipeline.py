from backend.services.pdf_extractor import extract_text_from_pdf
from backend.services.guideline_processor import process_guideline_pages


def process_guideline_pdf(file_path):
    """
    Extract text from a PDF and convert it into
    structured guideline chunks.
    """

    # Step 1: Extract PDF text
    extraction_result = extract_text_from_pdf(file_path)

    if not extraction_result["success"]:
        return {
            "success": False,
            "error": extraction_result["error"]
        }

    # Step 2: Process extracted pages
    chunks = process_guideline_pages(
        extraction_result["pages"]
    )

    if not chunks:
        return {
            "success": False,
            "error": "No guideline content could be processed."
        }

    # Step 3: Return structured result
    return {
        "success": True,
        "total_pages": extraction_result["total_pages"],
        "total_chunks": len(chunks),
        "chunks": chunks
    }