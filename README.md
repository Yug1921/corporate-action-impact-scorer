# 📊 Corporate Action Impact Scorer

> AI-powered analysis of NSE/BSE corporate filings — extracts, scores, and ranks announcements by market impact potential.

![Tech Stack](https://img.shields.io/badge/FastAPI-0.111-009688?style=flat-square&logo=fastapi)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)
![AI Model](https://img.shields.io/badge/Mistral--7B-OpenRouter-orange?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

---

## 🎯 What It Does

Fetches 5 real corporate announcement PDFs from NSE/BSE archives, uses an LLM to extract structured data (company, announcement type, financial value, sector, counterparty), then scores each announcement across **5 market-impact dimensions** for a total score out of 100.

Results are displayed in a Bloomberg-terminal-inspired dashboard with:
- Animated score rings per document
- 5-dimension radar charts
- Detailed AI reasoning per dimension
- Ranked leaderboard view

---

## 🧠 Scoring Framework

Each document is scored across 5 dimensions (0–20 pts each = **100 max**):

| Dimension | What It Measures |
|---|---|
| **Financial Magnitude** | Order/contract value (₹ crore) |
| **Sector Sensitivity** | How market-sensitive the sector is (defense > IT > generic) |
| **Revenue Contribution** | Estimated % of company revenue this represents |
| **Announcement Credibility** | Quality of filing — named counterparty, govt contracts score higher |
| **Market Impact Potential** | Expected short-term stock price catalyst potential |

**Rating tiers:**
- 🔴 CRITICAL: 80–100
- 🟠 HIGH: 60–79
- 🟡 MODERATE: 40–59
- 🟢 LOW: 20–39
- ⚪ MINIMAL: 0–19

---

## 🏗 Architecture

```
corporate-impact-scorer/
├── backend/                  # FastAPI Python server
│   ├── main.py               # REST API + async job queue
│   ├── pdf_fetcher.py        # PDF download with anti-bot headers + pdfplumber
│   ├── scorer.py             # OpenRouter/Mistral-7B extraction & scoring
│   ├── requirements.txt
│   └── .env.example
└── frontend/                 # Next.js 14 dashboard
    ├── app/
    │   ├── page.tsx           # Main app (idle/processing/completed states)
    │   ├── lib/api.ts         # Backend client + TypeScript types
    │   └── components/
    │       ├── ScoreCard.tsx         # Per-document score card + radar chart
    │       ├── ProcessingPanel.tsx   # Terminal-style loading UI
    │       └── RankingLeaderboard.tsx # Ranked comparison table
    └── .env.example
```

**Request flow:**
1. Frontend calls `POST /api/analyze` → gets `job_id`
2. Backend spawns background job, fetches each PDF with session/cookie spoofing
3. pdfplumber extracts text; Mistral-7B (via OpenRouter) extracts structured data
4. Second LLM call scores across 5 dimensions with explicit reasoning
5. Frontend polls `GET /api/job/{id}` every 2s — shows partial results live
6. Final results ranked by total score, displayed with radar charts

---

## 🚀 Setup & Installation

### Prerequisites
- Python 3.10+
- Node.js 18+
- Free [OpenRouter](https://openrouter.ai) API key (Mistral-7B is free tier)

### Backend

```bash
cd backend
cp .env.example .env
# Edit .env and add your OPENROUTER_API_KEY

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API will be live at `http://localhost:8000`

### Frontend

```bash
cd frontend
cp .env.example .env.local
# NEXT_PUBLIC_API_URL=http://localhost:8000 (already set)

npm install
npm run dev
```

Dashboard at `http://localhost:3000`

---

## 📸 Output

The dashboard shows:
1. **Processing screen** — terminal-style progress with live step tracking
2. **Score Cards** — per-document card with animated score ring, 5-bar breakdown, expandable radar chart + AI reasoning
3. **Rankings view** — leaderboard sorted by total impact score

---

## 🔧 Technical Notes

### PDF Fetching Strategy
NSE/BSE block automated bots. The fetcher handles this by:
- Rotating browser User-Agent strings
- Warming the session with a homepage visit (cookie acquisition)
- Using correct `Referer` headers matching the source domain
- Retry logic with exponential backoff (3 attempts)

If fetch fails, the document is marked `fetch_failed` and the UI shows the error inline — the pipeline continues with remaining documents.

### AI Pipeline
- **Extraction prompt**: Structured JSON output with 10 fields (company, ticker, financial value, sector, counterparty, etc.)
- **Scoring prompt**: Explicit 0–20 rubric per dimension with band descriptions — forces consistent, calibrated output
- Temperature set to 0.1 for reproducibility
- Text truncated to 3000 chars (most relevant info is in the header section of regulatory filings)

### Async Jobs
The backend uses FastAPI `BackgroundTasks` + an in-memory job store. This allows the frontend to poll for partial results as each PDF is processed sequentially, giving a live streaming effect.

---

## 📋 Approach Summary (for submission)

1. **PDF Ingestion**: `requests` + rotating headers/session cookies to bypass NSE/BSE bot detection; `pdfplumber` for text extraction
2. **AI Extraction**: OpenRouter (Mistral-7B, free) with a structured JSON prompt to extract company, type, financial value, sector, counterparty, and time horizon
3. **Scoring Logic**: A second LLM call with an explicit 5-dimension rubric (Financial Magnitude, Sector Sensitivity, Revenue Contribution, Credibility, Market Impact) — each scored 0–20 with defined bands, total = 100
4. **Ranking**: Documents sorted by total score; rated CRITICAL/HIGH/MODERATE/LOW/MINIMAL
5. **UI**: Next.js 14 + Tailwind dashboard with animated score rings, radar charts (Recharts), live polling during processing, cards + leaderboard views

---

## 🛠 Stack

| Layer | Technology |
|---|---|
| Backend API | FastAPI (Python) |
| PDF Parsing | pdfplumber |
| AI Model | Mistral-7B via OpenRouter (free) |
| Frontend | Next.js 14 + TypeScript |
| Styling | Tailwind CSS |
| Charts | Recharts |
| HTTP Client | httpx (backend), fetch (frontend) |