const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface PDFMeta {
  id: string;
  url: string;
  label: string;
}

export interface ScoreDimension {
  score: number;
  reasoning: string;
}

export interface Scores {
  financial_magnitude?: ScoreDimension;
  sector_sensitivity?: ScoreDimension;
  revenue_contribution?: ScoreDimension;
  announcement_credibility?: ScoreDimension;
  market_impact_potential?: ScoreDimension;
  total_score: number;
  max_score?: number;
  score_percentage?: number;
  rating: string;
  rating_color: string;
  overall_justification?: string;
  analyst_note?: string;
}

export interface ExtractedInfo {
  company_name: string;
  ticker?: string;
  announcement_type: string;
  financial_value?: string;
  financial_value_inr_crore?: number;
  sector: string;
  counterparty?: string;
  time_horizon: string;
  summary: string;
  key_facts: string[];
}

export interface AnalysisResult {
  id: string;
  url: string;
  label: string;
  status: string;
  fetch_error?: string;
  extracted?: ExtractedInfo;
  scores?: Scores;
  rank?: number;
  char_count?: number;
}

export interface JobResponse {
  job_id: string;
  status: string;
  progress: number;
  results: AnalysisResult[];
  error?: string;
  created_at: string;
  completed_at?: string;
}

export async function startAnalysis(pdfs?: PDFMeta[]): Promise<{ job_id: string }> {
  const res = await fetch(`${API_BASE}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pdfs: pdfs || null }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function pollJob(jobId: string): Promise<JobResponse> {
  const res = await fetch(`${API_BASE}/api/job/${jobId}`);
  if (!res.ok) throw new Error(`Job not found: ${jobId}`);
  return res.json();
}

export async function getDefaultPDFs(): Promise<PDFMeta[]> {
  const res = await fetch(`${API_BASE}/api/default-pdfs`);
  if (!res.ok) throw new Error("Could not fetch default PDFs");
  const data = await res.json();
  return data.pdfs;
}

export const DIMENSION_LABELS: Record<string, string> = {
  financial_magnitude: "Financial Magnitude",
  sector_sensitivity: "Sector Sensitivity",
  revenue_contribution: "Revenue Contribution",
  announcement_credibility: "Announcement Credibility",
  market_impact_potential: "Market Impact Potential",
};

export const DIMENSION_ICONS: Record<string, string> = {
  financial_magnitude: "₹",
  sector_sensitivity: "⚡",
  revenue_contribution: "📈",
  announcement_credibility: "🏛",
  market_impact_potential: "🎯",
};

export function getRatingColor(rating: string): string {
  const map: Record<string, string> = {
    CRITICAL: "#FF4444",
    HIGH: "#FF8C00",
    MODERATE: "#FFD700",
    LOW: "#00FF88",
    MINIMAL: "#9E9E9E",
    ERROR: "#555555",
    FETCH_ERROR: "#555555",
  };
  return map[rating] || "#9E9E9E";
}