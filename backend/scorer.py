import os
import json
import re
import time
import httpx
from dotenv import load_dotenv

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

# Current verified free models on OpenRouter as of June 2026
# Ordered: best quality first, fallback to smaller/faster
MODELS = [
    "google/gemma-4-31b-it:free",   # Best free model (Quality 65), 262K ctx
]

INTER_DOC_DELAY = 12  # seconds between documents (stay under 20 req/min)

COMBINED_PROMPT = """You are a financial analyst scoring Indian stock exchange filings.
Analyze this corporate announcement and return ONE JSON object only. No markdown. No explanation. No thinking tags.

DOCUMENT:
{text}

Return exactly this JSON structure:
{{
  "company_name": "full company name from the document header",
  "ticker": "NSE/BSE ticker if present else null",
  "announcement_type": "Order Win or GST Demand or Acquisition or Joint Venture or Regulatory Filing or Other",
  "financial_value": "monetary value string like Rs.250 Cr or null",
  "financial_value_inr_crore": 250,
  "sector": "industry sector",
  "counterparty": "client or authority name or null",
  "time_horizon": "Short-term (0-6 months) or Medium-term (6-18 months) or Long-term (18+ months) or Unknown",
  "summary": "2-3 sentence plain English summary of what was announced",
  "key_facts": ["fact1", "fact2", "fact3"],
  "scores": {{
    "financial_magnitude": {{"score": 12, "reason": "one sentence"}},
    "sector_sensitivity": {{"score": 14, "reason": "one sentence"}},
    "revenue_contribution": {{"score": 10, "reason": "one sentence"}},
    "announcement_credibility": {{"score": 15, "reason": "one sentence"}},
    "market_impact_potential": {{"score": 12, "reason": "one sentence"}}
  }},
  "analyst_note": "one sharp market insight about this announcement"
}}

Scoring guide (score 0-20 each):
financial_magnitude: 0-5=none, 6-10=under Rs50Cr, 11-15=Rs50-500Cr, 16-20=over Rs500Cr
sector_sensitivity: 0-5=generic, 6-10=IT/FMCG, 11-15=infra/energy, 16-20=defense/banking
revenue_contribution: 0-5=negligible, 6-10=under 5pct, 11-15=5-15pct, 16-20=over 15pct
announcement_credibility: 0-5=vague, 6-10=basic filing, 11-15=named counterparty, 16-20=govt/PSU contract
market_impact_potential: 0-5=no reaction, 6-10=mild, 11-15=analyst attention, 16-20=strong catalyst"""


def _strip_thinking(text: str) -> str:
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)
    text = re.sub(r"<thinking>.*?</thinking>", "", text, flags=re.DOTALL)
    text = re.sub(r"<reasoning>.*?</reasoning>", "", text, flags=re.DOTALL)
    return text.strip()


def _call_openrouter(prompt: str, max_tokens: int = 1200, cancelled_flag: list = None) -> str:
    """
    Try each model once. On 429 → skip immediately (preserve quota).
    On 404 → skip (model unavailable). On 5xx → one retry.
    cancelled_flag: a mutable list [False] — set to [True] to abort mid-flight.
    """
    if not OPENROUTER_API_KEY:
        raise ValueError("OPENROUTER_API_KEY not set in .env file")

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://corporate-impact-scorer.app",
        "X-Title": "Corporate Impact Scorer",
    }

    last_error = None

    for model in MODELS:
        # Check cancellation before each model attempt
        if cancelled_flag and cancelled_flag[0]:
            raise Exception("Job cancelled by user")

        print(f"[OpenRouter] Trying: {model}")
        payload = {
            "model": model,
            "max_tokens": max_tokens,
            "temperature": 0.1,
            "messages": [{"role": "user", "content": prompt}],
        }

        try:
            with httpx.Client(timeout=60) as client:
                response = client.post(OPENROUTER_URL, json=payload, headers=headers)

            if response.status_code == 429:
                print(f"[OpenRouter] 429 on {model} — skipping (quota preserved)")
                last_error = f"429 rate limit on {model}"
                time.sleep(2)
                continue

            if response.status_code in (400, 404):
                print(f"[OpenRouter] {response.status_code} on {model} — unavailable, skipping")
                last_error = f"{response.status_code} on {model}"
                continue

            if response.status_code >= 500:
                print(f"[OpenRouter] {response.status_code} on {model} — retrying once...")
                time.sleep(8)
                with httpx.Client(timeout=60) as client:
                    response = client.post(OPENROUTER_URL, json=payload, headers=headers)
                if not response.ok:
                    last_error = f"5xx on {model}"
                    continue

            response.raise_for_status()
            data = response.json()

            if not data.get("choices"):
                last_error = "Empty choices"
                continue

            content = data["choices"][0]["message"]["content"]
            if not content or not content.strip():
                last_error = "Empty content"
                continue

            print(f"[OpenRouter] SUCCESS via: {data.get('model', model)}")
            return content

        except httpx.TimeoutException:
            print(f"[OpenRouter] Timeout on {model} — skipping")
            last_error = f"Timeout on {model}"
            continue
        except httpx.RequestError as e:
            print(f"[OpenRouter] Network error on {model}: {e}")
            last_error = str(e)
            continue

    raise Exception(
        f"All {len(MODELS)} models failed. Last error: {last_error}\n"
        "Check openrouter.ai/models for current free model availability."
    )


def _parse_json_response(raw: str) -> dict:
    cleaned = _strip_thinking(raw)
    cleaned = re.sub(r"```(?:json)?\n?", "", cleaned).strip().rstrip("`").strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1:
        raise ValueError(f"No JSON object found. Preview: {raw[:200]}")
    return json.loads(cleaned[start:end + 1])


def _compute_rating(total: int):
    if total >= 80:
        return "TRANSFORMATIVE", "#FFB000"
    elif total >= 60:
        return "MAJOR", "#00D4FF"
    elif total >= 40:
        return "MATERIAL", "#00FF88"
    elif total >= 20:
        return "EMERGING", "#94A3B8"
    return "LIMITED", "#64748B"


def _error_result(label: str, error: str) -> dict:
    dims = ["financial_magnitude", "sector_sensitivity", "revenue_contribution",
            "announcement_credibility", "market_impact_potential"]
    return {
        "extracted": {
            "company_name": label,
            "ticker": None,
            "announcement_type": "Unknown",
            "financial_value": None,
            "financial_value_inr_crore": None,
            "sector": "Unknown",
            "counterparty": None,
            "time_horizon": "Unknown",
            "summary": f"Analysis failed: {error}",
            "key_facts": [],
            "analyst_note": None,
        },
        "scores": {
            **{d: {"score": 0, "reason": "error"} for d in dims},
            "total_score": 0,
            "max_score": 100,
            "score_percentage": 0.0,
            "rating": "ERROR",
            "rating_color": "#9E9E9E",
            "overall_justification": error,
            "analyst_note": "",
        },
    }


def analyze_document(text: str, label: str = "Unknown", cancelled_flag: list = None) -> dict:
    """Single LLM call: extract info + score in one shot."""
    truncated = text[:3000] if len(text) > 3000 else text
    prompt = COMBINED_PROMPT.format(text=truncated)

    try:
        raw = _call_openrouter(prompt, max_tokens=1200, cancelled_flag=cancelled_flag)
        result = _parse_json_response(raw)
    except Exception as e:
        print(f"[Analyzer] FAILED for '{label}': {e}")
        return _error_result(label, str(e))

    scores_raw = result.pop("scores", {})
    dims = ["financial_magnitude", "sector_sensitivity", "revenue_contribution",
            "announcement_credibility", "market_impact_potential"]
    total = sum(scores_raw.get(d, {}).get("score", 0) for d in dims)
    rating, color = _compute_rating(total)

    company = result.get("company_name", "")
    if not company or company.strip().lower() in ("unknown", ""):
        result["company_name"] = label

    scores = {
        **{d: scores_raw.get(d, {"score": 0, "reason": "not scored"}) for d in dims},
        "total_score": total,
        "max_score": 100,
        "score_percentage": round(total / 100 * 100, 1),
        "rating": rating,
        "rating_color": color,
        "overall_justification": result.get("analyst_note", ""),
        "analyst_note": result.get("analyst_note", ""),
    }

    print(f"[Analyzer] OK: {result.get('company_name')} | {total}/100 | {rating}")
    return {"extracted": result, "scores": scores}