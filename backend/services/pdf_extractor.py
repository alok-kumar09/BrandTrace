import pymupdf





def extract_text_from_pdf(file_path):
    """
    Extract text from all pages of a PDF file.
    """

    try:
        document = pymupdf.open(file_path)

        extracted_pages = []

        for page_number, page in enumerate(document, start=1):
            page_text = page.get_text("text")

            if page_text.strip():
                extracted_pages.append({
                    "page": page_number,
                    "text": page_text.strip()
                })

        document.close()

        if not extracted_pages:
            return {
                "success": False,
                "error": "No readable text found in the PDF."
            }

        return {
            "success": True,
            "pages": extracted_pages,
            "total_pages": len(extracted_pages)
        }

    except Exception:
        return {
            "success": False,
            "error": "Unable to read the PDF file."
        }