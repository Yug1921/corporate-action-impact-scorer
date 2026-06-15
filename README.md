# 📊 Corporate Action Impact Scorer

AI-powered analysis of NSE/BSE corporate filings — extracts, scores, and ranks announcements by market impact potential.

**🔗 Live App:** [corporate-action-impact-scorer.vercel.app](https://corporate-action-impact-scorer.vercel.app/)
**📁 Repository:** [github.com/Yug1921/corporate-action-impact-scorer](https://github.com/Yug1921/corporate-action-impact-scorer)

---

## 📸 Output

### Score Cards — Ranked Dashboard
<img width="1918" height="922" alt="image" src="https://github.com/user-attachments/assets/ac5b19ea-8b43-4258-bdfc-615bee256a0d" />

### Upload Mode — Analyze a Custom PDF
<img width="1918" height="928" alt="image" src="https://github.com/user-attachments/assets/425ff283-84bc-4d9f-8da4-08ea58300e2f" />

### Live Processing
<img width="1918" height="925" alt="image" src="https://github.com/user-attachments/assets/5a5b0809-2a33-47c4-84a3-b28af5d40ea8" />

### Rankings — Leaderboard View
<img width="1918" height="925" alt="image" src="https://github.com/user-attachments/assets/922d50bc-ce55-4938-a496-5977bc53ad60" />
<img width="1918" height="930" alt="image" src="https://github.com/user-attachments/assets/abf47324-7302-497b-a17f-0809ce31284b" />


---

## 🎯 What It Does

This system ingests corporate action / order announcement PDFs from NSE/BSE, uses an LLM to extract structured information (company, announcement type, financial value, sector, counterparty, time horizon), and computes a **5-dimension impact score (0–100)** indicating how significant the announcement is from a market perspective.

Results are displayed in a financial-terminal-inspired dashboard with animated score rings, radar charts, per-dimension AI reasoning, and a ranked leaderboard.

### Two Modes of Use

1. **NSE/BSE Filings (Batch Mode)** — runs the full pipeline on 5 pre-configured real corporate filing PDFs at once, with live progress and a ranked comparison view.
2. **Upload PDF (Single Mode)** — upload any corporate filing PDF of your own and get an instant impact score using the same scoring engine.

---

## 🧠 Scoring Framework

Each document is scored across **5 dimensions (0–20 pts each = 100 max)**, with explicit scoring bands so results are consistent and explainable:

| Dimension | What It Measures | Bands |
|---|---|---|
| **Financial Magnitude** | Order/contract value | 0-5 none · 6-10 <₹50Cr · 11-15 ₹50-500Cr · 16-20 >₹500Cr |
| **Sector Sensitivity** | How market-sensitive the sector is | 0-5 generic · 6-10 IT/FMCG · 11-15 infra/energy · 16-20 defense/banking |
| **Revenue Contribution** | Estimated % of company revenue | 0-5 negligible · 6-10 <5% · 11-15 5-15% · 16-20 >15% |
| **Announcement Credibility** | Quality of filing & counterparty | 0-5 vague · 6-10 basic · 11-15 named counterparty · 16-20 govt/PSU |
| **Market Impact Potential** | Expected stock price reaction | 0-5 minimal · 6-10 mild · 11-15 notable · 16-20 strong catalyst |

### Rating Tiers

| Rating | Score Range |
|---|---|
| 🟡 **TRANSFORMATIVE** | 80–100 |
| 🔵 **MAJOR** | 60–79 |
| 🟢 **MATERIAL** | 40–59 |
| ⚪ **EMERGING** | 20–39 |
| ⚫ **LIMITED** | 0–19 |

Each dimension also includes a one-line AI-generated rationale explaining the score, plus an overall analyst note per document.

---

## 🏗 Architecture

```
corporate-impact-scorer/
├── backend/                  # FastAPI Python server
│   ├── main.py               # REST API, async job queue, cancellation
│   ├── pdf_fetcher.py         # PDF download with anti-bot headers + pdfplumber
│   ├── scorer.py              # OpenRouter extraction & scoring (single-call)
│   ├── requirements.txt
│   └── .env.example
└── frontend/                  # Next.js 14 dashboard
    ├── app/
    │   ├── page.tsx            # Main app (idle/processing/completed states)
    │   ├── lib/api.ts           # Backend client + TypeScript types
    │   └── components/
    │       ├── ScoreCard.tsx          # Per-document score card + radar chart
    │       ├── ProcessingPanel.tsx    # Terminal-style live progress UI
    │       └── RankingLeaderboard.tsx # Ranked comparison table
    └── .env.example
```

### Request Flow

1. Frontend calls `POST /api/analyze` → receives a `job_id`
2. Backend spawns a background job and processes documents **sequentially**
3. For each document: `pdf_fetcher.py` downloads the PDF (with session/cookie spoofing for NSE/BSE) and extracts text via `pdfplumber`
4. **A single LLM call** extracts structured fields *and* computes all 5 dimension scores in one combined JSON response — minimizing API calls and latency
5. Frontend polls `GET /api/job/{id}` every 2s and renders **partial results live** as each document finishes
6. Once complete, results are ranked by total score and rendered with radar charts and a leaderboard

---

## 🚀 Setup & Installation

### Prerequisites

- Python 3.10+
- Node.js 18+
- Free [OpenRouter](https://openrouter.ai) API key

### Backend

```bash
cd backend
cp .env.example .env
# Edit .env and add your OPENROUTER_API_KEY

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API runs at `http://localhost:8000`

### Frontend

```bash
cd frontend
cp .env.example .env.local
# NEXT_PUBLIC_API_URL=http://localhost:8000 (default for local dev)

npm install
npm run dev
```

Dashboard runs at `http://localhost:3000`

On first load, you'll be prompted to enter your OpenRouter API key — it's stored only in your browser's local storage and sent with each request.

---

## 🔧 Technical Notes

### AI Pipeline — Single-Call Design

Unlike a typical two-pass (extract → score) pipeline, this system uses **one combined LLM call per document** that returns both the extracted fields and all 5 dimension scores with reasoning in a single structured JSON object. This roughly halves the number of API calls needed, which matters significantly on free-tier rate limits.

- **Temperature:** 0.1, for reproducible scoring
- **Input truncation:** Document text truncated to 3000 characters (key info is in the header/summary section of regulatory filings)
- **Output parsing:** Strips `<think>`/`<reasoning>` tags some models emit, then extracts the JSON object regardless of surrounding markdown or preamble

### Multi-Model Retry & Fallback Chain

Free-tier LLM endpoints are rate-limited and occasionally return malformed JSON. To maximize reliability, `scorer.py` implements:

- An ordered list of free OpenRouter models, each with its own retry count (e.g., the primary model gets multiple attempts with a short cooldown; fallbacks are single-shot)
- **Any failure type** — HTTP error, timeout, empty response, *or malformed JSON* — is treated uniformly and triggers a retry or fallback to the next model
- A **full-pass retry**: if every model in the chain fails once, the system cools down briefly and walks the entire chain again before marking the document as failed — this catches per-minute rate-limit windows that a single short retry can't clear

### PDF Fetching Strategy

NSE/BSE block automated requests. The fetcher handles this by:

- Rotating browser User-Agent strings
- Warming the session with a homepage visit (cookie acquisition)
- Using correct `Referer` headers matching the source domain
- Retry logic with exponential backoff

If a fetch fails, the document is marked `fetch_failed`, the UI shows the error inline, and the pipeline continues with remaining documents.

### Async Jobs & Cancellation

The backend uses FastAPI `BackgroundTasks` with an in-memory job store. Documents are processed sequentially with a short delay between each (to respect free-tier rate limits), while the frontend polls for live partial results. Jobs can be cancelled mid-run via `POST /api/job/{id}/cancel` — the background task checks a shared cancellation flag between documents, between retry attempts, and during delays.

---

## ⚠️ Free-Tier Notice

This project is intentionally built on **100% free infrastructure** — free OpenRouter models, free-tier hosting for both frontend and backend — to keep it zero-cost and easy to reproduce.

As a result:

- **Processing takes ~30–90 seconds per document** (5 documents ≈ 3–8 minutes for batch mode). Please be patient while a job runs.
- The pipeline has been thoroughly tested and reliably produces correct, scored output.
- Occasionally, free-tier AI rate limits across all fallback models may be temporarily exhausted, causing a document to fail. **If this happens, simply retry after a minute or two** — it will go through.

---

## 🛠 Stack

| Layer | Technology |
|---|---|
| Backend API | FastAPI (Python) |
| PDF Parsing | pdfplumber |
| AI Models | Gemma / Llama 3.3 / Qwen3 (free, via OpenRouter, multi-model fallback) |
| Frontend | Next.js 14 + TypeScript |
| Styling | Tailwind CSS |
| Charts | Recharts (radar charts) |
| HTTP Client | httpx (backend), fetch (frontend) |
| Hosting | Vercel (frontend) + free-tier backend host |

---

## 📋 Approach Summary (for submission)

- **PDF Ingestion:** `requests` with rotating headers/session cookies to bypass NSE/BSE bot detection; `pdfplumber` for text extraction; supports both pre-configured filing URLs and direct user uploads
- **AI Extraction + Scoring:** A single OpenRouter LLM call per document returns structured fields (company, ticker, type, financial value, sector, counterparty, time horizon) *and* all 5 dimension scores with reasoning, in one JSON response
- **Scoring Logic:** Self-defined 5-dimension rubric (Financial Magnitude, Sector Sensitivity, Revenue Contribution, Credibility, Market Impact), each scored 0–20 against explicit bands, summing to a 0–100 total mapped to 5 rating tiers
- **Reliability:** Multi-model retry/fallback chain with a full-pass cooldown retry to handle free-tier rate limiting
- **Ranking:** Documents sorted by total score and displayed with rank badges
- **UI:** Next.js 14 + Tailwind dashboard with animated score rings, radar charts, live polling during processing, cancellable jobs, and both card and leaderboard views
