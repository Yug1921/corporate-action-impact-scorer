import os
import json
import re
import time
import httpx
from dotenv import load_dotenv

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

# (model_id, max_attempts, delay_between_retries_seconds)
# Gemma is the most reliable free model on this key — give it 2 quick tries.
# The rest are single-shot fallbacks spread across separate quota pools.
MODELS = [
    ("google/gemma-4-31b-it:free", 2, 5),
    ("meta-llama/llama-3.3-70b-instruct:free", 1, 0),
    ("qwen/qwen3-next-80b-a3b-instruct:free", 1, 0),
    ("meta-llama/llama-3.2-3b-instruct:free", 1, 0),
    ("nvidia/nemotron-nano-9b-v2:free", 1, 0),
]

# If EVERY model in MODELS fails (full pass), cool down and walk the whole
# chain again. This catches per-minute rate-limit windows that a single
# 5s per-model retry is too short to clear.
FULL_PASS_RETRIES = 2
FULL_PASS_COOLDOWN = 20  # seconds between full passes

INTER_DOC_DELAY = 6  # seconds between documents (stay under free-tier rate limits)

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
  "summary": "ONE concise sentence (max 18 words) summarizing what was announced - must be a complete sentence that fits on two short lines",
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


class JobCancelled(Exception):
    """Raised when the user cancels a job mid-flight."""
    pass


def _check_cancelled(cancelled_flag: list = None):
    if cancelled_flag and cancelled_flag[0]:
        raise JobCancelled("Job cancelled by user")


def _cancellable_sleep(seconds: int, cancelled_flag: list = None):
    """Sleep in 1s increments, raising JobCancelled promptly if cancelled."""
    for _ in range(seconds):
        _check_cancelled(cancelled_flag)
        time.sleep(1)


def _strip_thinking(text: str) -> str:
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)
    text = re.sub(r"<thinking>.*?</thinking>", "", text, flags=re.DOTALL)
    text = re.sub(r"<reasoning>.*?</reasoning>", "", text, flags=re.DOTALL)
    return text.strip()


def _parse_json_response(raw: str) -> dict:
    cleaned = _strip_thinking(raw)
    cleaned = re.sub(r"```(?:json)?\n?", "", cleaned).strip().rstrip("`").strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1:
        raise ValueError(f"No JSON object found. Preview: {raw[:200]}")
    return json.loads(cleaned[start:end + 1])


def _single_attempt(model: str, prompt: str, max_tokens: int, headers: dict, cancelled_flag: list) -> dict:
    """
    One HTTP call + JSON parse. Raises on ANY failure — HTTP error,
    timeout, empty response, OR malformed JSON — so the caller can
    retry/fallback uniformly regardless of *why* it failed.
    Returns the parsed dict on success.
    """
    _check_cancelled(cancelled_flag)

    payload = {
        "model": model,
        "max_tokens": max_tokens,
        "temperature": 0.1,
        "messages": [{"role": "user", "content": prompt}],
    }

    with httpx.Client(timeout=60) as client:
        response = client.post(OPENROUTER_URL, json=payload, headers=headers)

    if response.status_code == 429:
        raise RuntimeError(f"429 rate limited on {model}")
    if response.status_code in (400, 404):
        raise RuntimeError(f"{response.status_code} model unavailable: {model}")
    if response.status_code >= 500:
        raise RuntimeError(f"{response.status_code} server error on {model}")

    response.raise_for_status()
    data = response.json()

    if not data.get("choices"):
        raise RuntimeError(f"Empty choices from {model}")

    content = data["choices"][0]["message"]["content"]
    if not content or not content.strip():
        raise RuntimeError(f"Empty content from {model}")

    # A malformed-JSON response is treated as a failure just like a
    # network/HTTP failure — it triggers a retry or fallback below.
    parsed = _parse_json_response(content)
    print(f"[OpenRouter] SUCCESS via: {data.get('model', model)}")
    return parsed


def _run_with_fallback(prompt: str, max_tokens: int, cancelled_flag: list = None) -> dict:
    """
    Walk MODELS in order. For each (model, max_attempts, retry_delay):
    retry that model up to max_attempts times, then move to the next
    model. Any failure type — 429, 5xx, timeout, empty response, bad
    JSON — counts the same and triggers a retry/fallback.

    If EVERY model in the list fails (a full pass), cool down for
    FULL_PASS_COOLDOWN seconds and walk the whole chain again, up to
    FULL_PASS_RETRIES times. This catches per-minute rate-limit
    windows that a short per-model retry can't clear.
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

    for full_pass in range(1, FULL_PASS_RETRIES + 1):
        for model, max_attempts, retry_delay in MODELS:
            for attempt in range(1, max_attempts + 1):
                _check_cancelled(cancelled_flag)
                print(f"[OpenRouter] pass {full_pass}/{FULL_PASS_RETRIES} — {model} attempt {attempt}/{max_attempts}")

                try:
                    return _single_attempt(model, prompt, max_tokens, headers, cancelled_flag)
                except JobCancelled:
                    raise
                except Exception as e:
                    last_error = f"{model} attempt {attempt}/{max_attempts}: {e}"
                    print(f"[OpenRouter] FAILED — {last_error}")

                    is_last_attempt = attempt == max_attempts
                    if not is_last_attempt:
                        wait = retry_delay if retry_delay > 0 else 1
                        print(f"[OpenRouter] Retrying {model} in {wait}s...")
                        _cancellable_sleep(wait, cancelled_flag)
                    continue

        # Entire model chain failed this pass.
        is_last_pass = full_pass == FULL_PASS_RETRIES
        if not is_last_pass:
            print(f"[OpenRouter] All models failed on pass {full_pass}/{FULL_PASS_RETRIES}. "
                  f"Cooling down {FULL_PASS_COOLDOWN}s before retrying full chain...")
            _cancellable_sleep(FULL_PASS_COOLDOWN, cancelled_flag)

    raise Exception(
        f"All models exhausted after {FULL_PASS_RETRIES} passes. Last error: {last_error}\n"
        "Check openrouter.ai/models for current free model availability, "
        "or this key's daily quota may be exhausted."
    )


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
    """Extract info + score in one shot, with multi-model retry/fallback."""
    truncated = text[:3000] if len(text) > 3000 else text
    prompt = COMBINED_PROMPT.format(text=truncated)

    try:
        result = _run_with_fallback(prompt, max_tokens=1200, cancelled_flag=cancelled_flag)
    except JobCancelled:
        raise
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