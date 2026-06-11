import requests
import pdfplumber
import io
import time
import random
from typing import Optional

# Rotate user agents to avoid bot detection on NSE/BSE
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
]

NSE_HEADERS = {
    "Accept": "application/pdf,application/octet-stream,*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Referer": "https://www.nseindia.com/",
    "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-site",
}

BSE_HEADERS = {
    "Accept": "application/pdf,application/octet-stream,*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.bseindia.com/",
    "Connection": "keep-alive",
}

SESSION_URLS = {
    "nseindia.com": "https://www.nseindia.com",
    "bseindia.com": "https://www.bseindia.com",
}


def _get_session_for_url(url: str) -> requests.Session:
    """Create a session and optionally warm it with a homepage visit to get cookies."""
    session = requests.Session()
    ua = random.choice(USER_AGENTS)

    if "nseindia.com" in url:
        headers = {**NSE_HEADERS, "User-Agent": ua}
        try:
            session.get(SESSION_URLS["nseindia.com"], headers=headers, timeout=10)
            time.sleep(1)
        except Exception:
            pass
        session.headers.update(headers)
    elif "bseindia.com" in url:
        headers = {**BSE_HEADERS, "User-Agent": ua}
        try:
            session.get(SESSION_URLS["bseindia.com"], headers=headers, timeout=10)
            time.sleep(1)
        except Exception:
            pass
        session.headers.update(headers)
    else:
        session.headers.update({"User-Agent": ua})

    return session


def fetch_pdf_bytes(url: str, retries: int = 3) -> Optional[bytes]:
    """Fetch PDF bytes from URL with retries and anti-bot measures."""
    for attempt in range(retries):
        try:
            session = _get_session_for_url(url)
            response = session.get(url, timeout=30, stream=True)
            response.raise_for_status()

            content_type = response.headers.get("Content-Type", "")
            if "pdf" not in content_type.lower() and "octet-stream" not in content_type.lower():
                # Try anyway if content is non-empty
                if len(response.content) < 1000:
                    raise ValueError(f"Unexpected content type: {content_type}")

            return response.content

        except Exception as e:
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
            else:
                raise RuntimeError(f"Failed to fetch PDF after {retries} attempts: {str(e)}")

    return None


def extract_text_from_bytes(pdf_bytes: bytes) -> str:
    """Extract all text from PDF bytes using pdfplumber."""
    text_parts = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                text_parts.append(text.strip())
    return "\n\n".join(text_parts)


def extract_text_from_file(file_bytes: bytes) -> str:
    """Extract text from uploaded PDF file bytes."""
    return extract_text_from_bytes(file_bytes)


def fetch_and_extract(url: str) -> dict:
    """Full pipeline: fetch URL → extract text → return structured result."""
    try:
        pdf_bytes = fetch_pdf_bytes(url)
        text = extract_text_from_bytes(pdf_bytes)
        return {
            "success": True,
            "url": url,
            "text": text,
            "char_count": len(text),
            "error": None,
        }
    except Exception as e:
        return {
            "success": False,
            "url": url,
            "text": "",
            "char_count": 0,
            "error": str(e),
        }