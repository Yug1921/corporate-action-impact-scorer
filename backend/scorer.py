import os
import json
import re
import httpx
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "mistralai/mistral-7b-instruct"  # Free on OpenRouter

EXTRACTION_PROMPT = """You are a financial analyst specializing in Indian listed companies and stock exchange filings.

Analyze the following corporate announcement document text and extract structured information.

Return ONLY a valid JSON object with these exact fields:
{{
  "company_name": "string - full company name",
  "ticker": "string - NSE/BSE ticker if mentioned, else null",
  "announcement_type": "string - e.g. Order Win, GST Demand, Acquisition, Joint Venture, Regulatory Filing, etc.",
  "financial_value": "string - monetary value mentioned (e.g. '₹250 Cr', '$10M'), or null if not mentioned",
  "financial_value_inr_crore": "number - estimated value in INR crore, or null",
  "sector": "string - industry sector",
  "counterparty": "string - client/authority/partner name, or null",
  "time_horizon": "string - Short-term (0-6 months), Medium-term (6-18 months), Long-term (18+ months), or Unknown",
  "summary": "string - 2-3 sentence plain English summary of the announcement",
  "key_facts": ["list", "of", "3-5", "key", "facts"]
}}

Document text:
{text}

Return ONLY the JSON object. No markdown, no explanation, no preamble."""

SCORING_PROMPT = """You are a senior equity research analyst at a top Indian brokerage house.

Evaluate this corporate announcement and score it across 5 dimensions. Each dimension is scored 0-20.

Announcement Summary:
- Company: {company_name}
- Type: {announcement_type}
- Financial Value: {financial_value}
- Sector: {sector}
- Time Horizon: {time_horizon}
- Summary: {summary}

Score each dimension strictly on a 0-20 scale:

1. FINANCIAL_MAGNITUDE (0-20): How significant is the financial value?
   - 0-5: Negligible or no financial value mentioned
   - 6-10: Moderate value (< ₹50 Cr or unclear)
   - 11-15: Significant value (₹50-500 Cr)
   - 16-20: Very large value (> ₹500 Cr or transformative)

2. SECTOR_SENSITIVITY (0-20): How market-sensitive is this sector?
   - 0-5: Low sensitivity (generic services)
   - 6-10: Moderate (IT services, FMCG)
   - 11-15: High (infrastructure, manufacturing, energy)
   - 16-20: Very high (defense, critical infrastructure, banking)

3. REVENUE_CONTRIBUTION (0-20): Potential % contribution to company revenue?
   - 0-5: Negligible contribution
   - 6-10: Minor (<5% revenue)
   - 11-15: Moderate (5-15% revenue)
   - 16-20: Major (>15% revenue or strategic)

4. ANNOUNCEMENT_CREDIBILITY (0-20): Quality and credibility of the announcement?
   - 0-5: Vague, no counterparty, speculative
   - 6-10: Basic filing with limited details
   - 11-15: Clear announcement with named counterparty
   - 16-20: High-credibility (govt contract, major PSU, international, audited)

5. MARKET_IMPACT_POTENTIAL (0-20): Likely short-to-medium term stock price impact?
   - 0-5: Minimal expected market reaction
   - 6-10: Mild positive/negative reaction expected
   - 11-15: Notable reaction, analyst attention likely
   - 16-20: Strong catalyst, significant price movement expected

Return ONLY a valid JSON object:
{{
  "financial_magnitude": {{"score": number, "reasoning": "one sentence explanation"}},
  "sector_sensitivity": {{"score": number, "reasoning": "one sentence explanation"}},
  "revenue_contribution": {{"score": number, "reasoning": "one sentence explanation"}},
  "announcement_credibility": {{"score": number, "reasoning": "one sentence explanation"}},
  "market_impact_potential": {{"score": number, "reasoning": "one sentence explanation"}},
  "overall_justification": "2-3 sentence overall assessment of why this scored as it did",
  "analyst_note": "one sharp insight a stock market analyst would highlight about this announcement"
}}

Return ONLY the JSON. No markdown."""


def _call_openrouter(prompt: str, max_tokens: int = 1000) -> str:
    """Make a single call to OpenRouter API."""
    if not OPENROUTER_API_KEY:
        raise ValueError("OPENROUTER_API_KEY not set in environment")

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://corporate-impact-scorer.app",
        "X-Title": "Corporate Impact Scorer",
    }

    payload = {
        "model": MODEL,
        "max_tokens": max_tokens,
        "temperature": 0.1,  # Low temp for consistent structured output
        "messages": [{"role": "user", "content": prompt}],
    }

    with httpx.Client(timeout=60) as client:
        response = client.post(OPENROUTER_URL, json=payload, headers=headers)
        response.raise_for_status()
        data = response.json()

    return data["choices"][0]["message"]["content"]


def _parse_json_response(raw: str) -> dict:
    """Safely parse JSON from LLM response, stripping markdown if present."""
    # Strip markdown code fences
    cleaned = re.sub(r"```(?:json)?\n?", "", raw).strip()
    cleaned = cleaned.rstrip("`").strip()
    return json.loads(cleaned)


def extract_document_info(text: str) -> dict:
    """Extract structured info from document text using LLM."""
    # Truncate text to avoid token limits (keep first 3000 chars - most info is up top)
    truncated = text[:3000] if len(text) > 3000 else text

    prompt = EXTRACTION_PROMPT.format(text=truncated)
    try:
        raw = _call_openrouter(prompt, max_tokens=800)
        return _parse_json_response(raw)
    except json.JSONDecodeError as e:
        return {
            "company_name": "Unknown",
            "ticker": None,
            "announcement_type": "Unknown",
            "financial_value": None,
            "financial_value_inr_crore": None,
            "sector": "Unknown",
            "counterparty": None,
            "time_horizon": "Unknown",
            "summary": "Could not parse document",
            "key_facts": [],
            "parse_error": str(e),
        }


def score_announcement(extracted_info: dict) -> dict:
    """Score an announcement across 5 dimensions using LLM."""
    prompt = SCORING_PROMPT.format(
        company_name=extracted_info.get("company_name", "Unknown"),
        announcement_type=extracted_info.get("announcement_type", "Unknown"),
        financial_value=extracted_info.get("financial_value", "Not mentioned"),
        sector=extracted_info.get("sector", "Unknown"),
        time_horizon=extracted_info.get("time_horizon", "Unknown"),
        summary=extracted_info.get("summary", "No summary available"),
    )

    try:
        raw = _call_openrouter(prompt, max_tokens=800)
        scores = _parse_json_response(raw)

        # Compute total score
        dimensions = [
            "financial_magnitude",
            "sector_sensitivity",
            "revenue_contribution",
            "announcement_credibility",
            "market_impact_potential",
        ]
        total = sum(scores[d]["score"] for d in dimensions if d in scores)
        scores["total_score"] = total
        scores["max_score"] = 100
        scores["score_percentage"] = round((total / 100) * 100, 1)

        # Assign rating tier
        if total >= 80:
            scores["rating"] = "CRITICAL"
            scores["rating_color"] = "#FF4444"
        elif total >= 60:
            scores["rating"] = "HIGH"
            scores["rating_color"] = "#FF8C00"
        elif total >= 40:
            scores["rating"] = "MODERATE"
            scores["rating_color"] = "#FFD700"
        elif total >= 20:
            scores["rating"] = "LOW"
            scores["rating_color"] = "#4CAF50"
        else:
            scores["rating"] = "MINIMAL"
            scores["rating_color"] = "#9E9E9E"

        return scores

    except Exception as e:
        return {
            "total_score": 0,
            "error": str(e),
            "rating": "ERROR",
            "rating_color": "#9E9E9E",
        }


def analyze_document(text: str) -> dict:
    """Full analysis pipeline: extract info + score."""
    extracted = extract_document_info(text)
    scores = score_announcement(extracted)
    return {
        "extracted": extracted,
        "scores": scores,
    }