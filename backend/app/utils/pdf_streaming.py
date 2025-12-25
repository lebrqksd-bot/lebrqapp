"""
PDF Streaming Utilities

Helper functions for generating PDFs that stream to clients instead of loading
entire PDF into memory. This prevents MemoryError for large PDFs.

Note: ReportLab builds PDFs in memory, but we can minimize memory usage by:
1. Using temporary files when possible
2. Streaming the result in chunks
3. Cleaning up immediately after streaming
"""
from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Callable, Generator
from fastapi.responses import StreamingResponse
from reportlab.platypus import SimpleDocTemplate
from reportlab.lib.pagesizes import letter


def stream_pdf_from_file(
    pdf_builder: Callable[[SimpleDocTemplate], None],
    filename: str,
    pagesize: tuple = letter,
    **doc_kwargs
) -> StreamingResponse:
    """
    Generate a PDF to a temporary file and stream it to the client.
    
    This function creates a temporary file, generates the PDF into it,
    then streams the file to the client in chunks without loading it entirely into memory.
    
    Args:
        pdf_builder: Function that takes a SimpleDocTemplate and builds the PDF story
        filename: Filename for the download
        pagesize: PDF page size (default: letter)
        **doc_kwargs: Additional arguments to pass to SimpleDocTemplate
    
    Returns:
        StreamingResponse with the PDF file
    """
    # Create temporary file for PDF generation
    # Using NamedTemporaryFile with delete=False so we can stream it
    temp_file = tempfile.NamedTemporaryFile(
        mode='wb',
        suffix='.pdf',
        delete=False
    )
    temp_path = temp_file.name
    temp_file.close()  # Close so reportlab can write to it
    
    try:
        # Create PDF document in temporary file
        doc = SimpleDocTemplate(
            temp_path,
            pagesize=pagesize,
            **doc_kwargs
        )
        
        # Build PDF using the provided builder function
        pdf_builder(doc)
        
        # Generator function to stream file in chunks and cleanup
        def generate() -> Generator[bytes, None, None]:
            """Stream file in chunks and cleanup after"""
            chunk_size = 64 * 1024  # 64KB chunks
            try:
                with open(temp_path, 'rb') as f:
                    while True:
                        chunk = f.read(chunk_size)
                        if not chunk:
                            break
                        yield chunk
            finally:
                # Clean up temporary file after streaming
                try:
                    if os.path.exists(temp_path):
                        os.unlink(temp_path)
                except Exception:
                    pass  # Ignore cleanup errors
        
        return StreamingResponse(
            generate(),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Cache-Control": "no-cache, no-store, must-revalidate",
            }
        )
        
    except Exception:
        # Clean up on error
        try:
            if os.path.exists(temp_path):
                os.unlink(temp_path)
        except Exception:
            pass
        raise


def create_pdf_to_buffer(pdf_builder: Callable[[SimpleDocTemplate], None], **doc_kwargs) -> bytes:
    """
    Generate PDF to a BytesIO buffer (for backward compatibility with small PDFs).
    
    WARNING: This loads the entire PDF into memory. For large PDFs, use 
    stream_pdf_from_file() to avoid MemoryError.
    
    Args:
        pdf_builder: Function that takes a SimpleDocTemplate and builds the PDF story
        **doc_kwargs: Additional arguments to pass to SimpleDocTemplate
    
    Returns:
        PDF content as bytes
    """
    from io import BytesIO
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, **doc_kwargs)
    pdf_builder(doc)
    buffer.seek(0)
    return buffer.read()

