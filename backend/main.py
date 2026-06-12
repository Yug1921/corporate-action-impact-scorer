from fastapi import FastAPI, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import asyncio
import uuid
import json
import os
import time
from datetime import datetime

from pdf_fetcher import fetch_and_extract, extract_text_from_file
from scorer import analyze_document, INTER_DOC_DELAY

app = FastAPI(title="Corporate Impact Scorer API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory job store (for demo purposes)
# In production, replace with Redis or a DB
JOBS: dict = {}

DEFAULT_PDFS = [
    {
        "id": "pdf1",
        "url": "https://nsearchives.nseindia.com/corporate/BHELCC_05062026113257_Info_to_SE_05_06_2026.pdf",
        "label": "BHELCC — Info to SE",
    },
    {
        "id": "pdf2",
        "url": "https://nsearchives.nseindia.com/corporate/BLUSPRING_05062026130923_Reg_30_-_SESI-BALCO.pdf",
        "label": "BLUSPRING — Reg 30 BALCO",
    },
    {
        "id": "pdf3",
        "url": "https://nsearchives.nseindia.com/corporate/ETHOS_05062026160606_Disclosure_GST_Order.pdf",
        "label": "ETHOS — GST Order Disclosure",
    },
    {
        "id": "pdf4",
        "url": "https://nsearchives.nseindia.com/corporate/EDUTECH_05062026174716_Disclosure_Reg_30_EDUTECH_05062026.pdf",
        "label": "EDUTECH — Reg 30 Disclosure",
    },
    {
        "id": "pdf5",
        "url": "https://www.bseindia.com/xml-data/corpfiling/AttachLive/cc79e53e-be66-400d-82db-6e88c3a42188.pdf",
        "label": "BSE Filing — Corporate Action",
    },
]


class AnalyzeRequest(BaseModel):
    pdfs: Optional[List[dict]] = None  # [{id, url, label}]


class JobStatus(BaseModel):
    job_id: str
    status: str  # pending | processing | completed | failed
    progress: int  # 0-100
    results: Optional[List[dict]] = None
    error: Optional[str] = None
    created_at: str
    completed_at: Optional[str] = None


def _process_single_pdf(pdf_meta: dict) -> dict:
    """Fetch, extract, and score a single PDF."""
    result = {
        "id": pdf_meta["id"],
        "url": pdf_meta["url"],
        "label": pdf_meta["label"],
        "status": "processing",
        "fetch_error": None,
        "extracted": None,
        "scores": None,
        "rank": None,
    }

    # Step 1: Fetch and extract text
    fetch_result = fetch_and_extract(pdf_meta["url"])

    if not fetch_result["success"] or not fetch_result["text"].strip():
        result["status"] = "fetch_failed"
        result["fetch_error"] = fetch_result.get("error", "Empty document")
        # Still try to score with empty data so UI shows partial result
        result["extracted"] = {
            "company_name": pdf_meta["label"].split("—")[0].strip(),
            "ticker": None,
            "announcement_type": "Unknown - PDF fetch failed",
            "financial_value": None,
            "financial_value_inr_crore": None,
            "sector": "Unknown",
            "counterparty": None,
            "time_horizon": "Unknown",
            "summary": f"Could not fetch PDF. Error: {result['fetch_error']}",
            "key_facts": [],
        }
        result["scores"] = {
            "total_score": 0,
            "rating": "FETCH_ERROR",
            "rating_color": "#555555",
            "score_percentage": 0,
        }
        return result

    # Step 2: AI Analysis
    analysis = analyze_document(fetch_result["text"])
    result["extracted"] = analysis["extracted"]
    result["scores"] = analysis["scores"]
    result["status"] = "completed"
    result["char_count"] = fetch_result["char_count"]

    return result


def _run_analysis_job(job_id: str, pdfs: List[dict]):
    """Background job: process all PDFs sequentially and update job store."""
    JOBS[job_id]["status"] = "processing"
    results = []
    total = len(pdfs)

    for i, pdf_meta in enumerate(pdfs):
        try:
            result = _process_single_pdf(pdf_meta)
            results.append(result)
        except Exception as e:
            results.append({
                "id": pdf_meta["id"],
                "url": pdf_meta["url"],
                "label": pdf_meta["label"],
                "status": "error",
                "fetch_error": str(e),
                "extracted": None,
                "scores": {"total_score": 0, "rating": "ERROR", "rating_color": "#555555", "score_percentage": 0},
            })

        progress = int(((i + 1) / total) * 100)
        JOBS[job_id]["progress"] = progress
        JOBS[job_id]["partial_results"] = results

        # Respect free tier: 20 req/min limit. Wait between documents.
        if i < total - 1:
            print(f"[Job] Waiting {INTER_DOC_DELAY}s before next document (rate limit buffer)...")
            time.sleep(INTER_DOC_DELAY)

    # Rank results by total score
    scored = [r for r in results if r.get("scores") and r["scores"].get("total_score", 0) > 0]
    scored.sort(key=lambda x: x["scores"]["total_score"], reverse=True)
    for rank, item in enumerate(scored, 1):
        item["rank"] = rank

    JOBS[job_id]["status"] = "completed"
    JOBS[job_id]["results"] = results
    JOBS[job_id]["completed_at"] = datetime.utcnow().isoformat()
    JOBS[job_id]["progress"] = 100


@app.get("/")
def root():
    return {"message": "Corporate Impact Scorer API", "version": "1.0.0"}


@app.get("/api/default-pdfs")
def get_default_pdfs():
    return {"pdfs": DEFAULT_PDFS}


@app.post("/api/analyze")
def start_analysis(request: AnalyzeRequest, background_tasks: BackgroundTasks):
    """Start async analysis job. Returns job_id for polling."""
    pdfs = request.pdfs or DEFAULT_PDFS
    job_id = str(uuid.uuid4())

    JOBS[job_id] = {
        "job_id": job_id,
        "status": "pending",
        "progress": 0,
        "results": None,
        "partial_results": [],
        "error": None,
        "created_at": datetime.utcnow().isoformat(),
        "completed_at": None,
    }

    background_tasks.add_task(_run_analysis_job, job_id, pdfs)
    return {"job_id": job_id, "status": "pending"}


@app.get("/api/job/{job_id}")
def get_job_status(job_id: str):
    """Poll job status and results."""
    if job_id not in JOBS:
        raise HTTPException(status_code=404, detail="Job not found")

    job = JOBS[job_id]
    return {
        "job_id": job_id,
        "status": job["status"],
        "progress": job["progress"],
        "results": job.get("results") or job.get("partial_results", []),
        "error": job.get("error"),
        "created_at": job["created_at"],
        "completed_at": job.get("completed_at"),
    }


@app.post("/api/upload")
async def upload_pdf(file: UploadFile = File(...), label: str = "Uploaded PDF"):
    """Analyze a manually uploaded PDF file."""
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    contents = await file.read()
    try:
        text = extract_text_from_file(contents)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not parse PDF: {str(e)}")

    if not text.strip():
        raise HTTPException(status_code=422, detail="PDF appears to be empty or image-only")

    analysis = analyze_document(text)
    return {
        "id": str(uuid.uuid4()),
        "label": label or file.filename,
        "filename": file.filename,
        "status": "completed",
        "char_count": len(text),
        "extracted": analysis["extracted"],
        "scores": analysis["scores"],
        "rank": None,
    }


@app.delete("/api/job/{job_id}")
def delete_job(job_id: str):
    if job_id in JOBS:
        del JOBS[job_id]
    return {"deleted": True}